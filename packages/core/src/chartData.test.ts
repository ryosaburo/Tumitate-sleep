import { describe, expect, it } from "vitest";
import { chartTop, elapsedDays, niceTop, simRecords } from "./chartData";
import { DEMO_RECORDS, DEMO_SETTINGS } from "./fixtures";
import { eqDrawdown } from "./reveal";
import { simulate } from "./simulate";
import type { DayRecord } from "./types";

const rec = (date: string, bed: number): DayRecord & { date: string } => ({ date, bed, wake: 630, screen: true, caffeine: false });

describe("elapsedDays", () => {
  it("未設定・開始前は 0、開始日は 1 日目", () => {
    expect(elapsedDays(null, "2026-10-12")).toBe(0);
    expect(elapsedDays("2026-10-13", "2026-10-12")).toBe(0);
    expect(elapsedDays("2026-10-12", "2026-10-12")).toBe(1);
  });
  it("30 日で止まる", () => {
    expect(elapsedDays("2026-10-01", "2026-10-30")).toBe(30);
    expect(elapsedDays("2026-10-01", "2026-12-31")).toBe(30);
  });
});

describe("simRecords", () => {
  it("開始日からの位置に入れる。範囲外と開始日未設定は無視する", () => {
    const out = simRecords([rec("2026-10-01", 1), rec("2026-10-03", 3), rec("2026-09-30", 9), rec("2026-11-05", 9)], "2026-10-01");
    expect(out).toHaveLength(30);
    expect(out[0]?.bed).toBe(1);
    expect(out[1]).toBeNull();
    expect(out[2]?.bed).toBe(3);
    expect(simRecords([rec("2026-10-01", 1)], null).every((x) => x === null)).toBe(true);
  });
});

describe("niceTop / chartTop", () => {
  it("切りのよい上限にする", () => {
    expect(niceTop(36000)).toEqual({ top: 40000, step: 10000 });
    expect(niceTop(41000)).toEqual({ top: 60000, step: 20000 });
  });
  it("記録がなくても 1000 以上の軸になる", () => {
    expect(chartTop(simulate([], DEMO_SETTINGS)).top).toBe(10000);
  });
  it("デモの 30 日は、評価額が軸に収まる", () => {
    const sim = simulate(DEMO_RECORDS, DEMO_SETTINGS);
    const { top } = chartTop(sim);
    expect(Math.max(...sim.map((s) => s.value))).toBeLessThan(top);
  });
});

describe("eqDrawdown", () => {
  it("最大下落は約 −14.4%", () => {
    const d = eqDrawdown();
    expect(d.maxDD).toBeCloseTo(-0.144, 3);
    expect([d.peakDay, d.troughDay]).toEqual([7, 18]);
  });
});
