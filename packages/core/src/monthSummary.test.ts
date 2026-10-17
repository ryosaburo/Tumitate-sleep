import { describe, expect, it } from "vitest";
import { DEMO_RECORDS, DEMO_SETTINGS } from "./fixtures";
import { monthSummary } from "./monthSummary";
import { simulate } from "./simulate";
import { ax } from "./time";
import type { DayRecord } from "./types";

const none = (n: number): (DayRecord | null)[] => Array.from({ length: n }, () => null);
const full = (bed: string): DayRecord => ({ bed: ax(bed), wake: ax("06:30"), screen: true, caffeine: true });

describe("monthSummary", () => {
  it("経過 0 日は null", () => {
    const sim = simulate(none(30), DEMO_SETTINGS);
    expect(monthSummary(none(30), sim, DEMO_SETTINGS.targetBed, 0)).toBeNull();
  });

  it("デモの 30 日: 日数・クリア・ズレの変化・資産", () => {
    const sim = simulate(DEMO_RECORDS, DEMO_SETTINGS);
    const m = monthSummary(DEMO_RECORDS, sim, DEMO_SETTINGS.targetBed, 30)!;
    expect(m.days).toBe(30);
    expect(m.recorded).toBe(30);
    expect(m.clearDays).toBe(sim.filter((d) => d.stat.clear).length);
    expect(m.weekCount).toBe(5);
    expect(Math.round(m.madFirst!)).toBe(124);
    expect(Math.round(m.madRecent!)).toBe(40);
    expect(m.trend).toBe("improved");
    expect(m.value).toBe(sim[29]!.value);
    expect(m.lines[0]).toContain("この30日間");
    expect(m.lines.join("")).toContain("推定値");
  });

  it("14 日未満は、初週と直近の比較をしない", () => {
    const recs = [...Array.from({ length: 10 }, () => full("23:30")), ...none(20)];
    const sim = simulate(recs, DEMO_SETTINGS);
    const m = monthSummary(recs, sim, DEMO_SETTINGS.targetBed, 10)!;
    expect(m.madFirst).toBeNull();
    expect(m.trend).toBeNull();
    expect(m.lines[0]).toContain("ここまでの 10 日間");
    expect(m.lines).toHaveLength(2); // 文章 + 平均時刻
  });

  it("記録が 3 日未満なら、平均時刻を出さない", () => {
    const recs = [full("23:30"), full("23:40"), ...none(28)];
    const sim = simulate(recs, DEMO_SETTINGS);
    const m = monthSummary(recs, sim, DEMO_SETTINGS.targetBed, 2)!;
    expect(m.avgBed).toBeNull();
    expect(m.recorded).toBe(2);
  });

  it("記録が 1 件もないときは、その旨だけを書く", () => {
    const sim = simulate(none(30), DEMO_SETTINGS);
    const m = monthSummary(none(30), sim, DEMO_SETTINGS.targetBed, 5)!;
    expect(m.lines).toEqual(["ここまでの 5 日間は、まだ記録がありません。"]);
  });

  it("ズレが 10 分以上増えたら wider、差が小さければ steady", () => {
    const base = Array.from({ length: 14 }, () => full("23:30"));
    const steady = [...base, ...none(16)];
    const wider = [...Array.from({ length: 7 }, () => full("23:30")), ...Array.from({ length: 7 }, () => full("01:00")), ...none(16)];
    const t = DEMO_SETTINGS.targetBed;
    expect(monthSummary(steady, simulate(steady, DEMO_SETTINGS), t, 14)!.trend).toBe("steady");
    const w = monthSummary(wider, simulate(wider, DEMO_SETTINGS), t, 14)!;
    expect(w.trend).toBe("wider");
    expect(w.lines.join("")).toContain("ばらつき");
  });
});
