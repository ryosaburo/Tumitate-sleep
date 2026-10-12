import { describe, expect, it } from "vitest";
import { contribution, dayStat, isDone } from "./achievement";
import { addDays, dateKey, daysBetween, parseKey } from "./date";
import { DEMO_RECORDS, DEMO_SETTINGS } from "./fixtures";
import { reveal } from "./reveal";
import { simulate } from "./simulate";
import { ax, clock } from "./time";
import type { DayRecord, Settings } from "./types";
import { madRange, weeklySummary } from "./weekly";

const empty: DayRecord = { bed: null, wake: null, screen: false, caffeine: false };
const settings = (tasks: Settings["tasks"]): Settings => ({ ...DEMO_SETTINGS, tasks });

describe("時刻の変換", () => {
  it("ax と clock は往復できる", () => {
    for (const t of ["20:00", "23:30", "00:00", "06:30", "11:59"]) {
      expect(clock(ax(t))).toBe(t);
    }
  });
  it("20:00 が 0、翌 0:00 が 240", () => {
    expect(ax("20:00")).toBe(0);
    expect(ax("00:00")).toBe(240);
  });
});

describe("日付の操作", () => {
  it("YYYY-MM-DD にする(ローカル時間)", () => {
    expect(dateKey(new Date(2026, 9, 11, 23, 59))).toBe("2026-10-11");
  });
  it("月またぎ・年またぎ", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("日数の差", () => {
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
    expect(parseKey("2026-10-11").getDate()).toBe(11);
  });
});

describe("達成判定の境界(TOL = 30)", () => {
  const rec = (bed: number | null): DayRecord => ({ ...empty, bed });
  it("ちょうど 30 分は達成", () => {
    expect(isDone(rec(DEMO_SETTINGS.targetBed + 30), "bed", DEMO_SETTINGS)).toBe(true);
    expect(isDone(rec(DEMO_SETTINGS.targetBed - 30), "bed", DEMO_SETTINGS)).toBe(true);
  });
  it("31 分は未達成", () => {
    expect(isDone(rec(DEMO_SETTINGS.targetBed + 31), "bed", DEMO_SETTINGS)).toBe(false);
    expect(isDone(rec(DEMO_SETTINGS.targetBed - 31), "bed", DEMO_SETTINGS)).toBe(false);
  });
  it("起床も同じ", () => {
    expect(isDone({ ...empty, wake: DEMO_SETTINGS.targetWake + 30 }, "wake", DEMO_SETTINGS)).toBe(true);
    expect(isDone({ ...empty, wake: DEMO_SETTINGS.targetWake + 31 }, "wake", DEMO_SETTINGS)).toBe(false);
  });
  it("未記録(null)は未達成。自己申告はそのまま使う", () => {
    expect(isDone(empty, "bed", DEMO_SETTINGS)).toBe(false);
    expect(isDone(null, "screen", DEMO_SETTINGS)).toBe(false);
    expect(isDone({ ...empty, screen: true }, "screen", DEMO_SETTINGS)).toBe(true);
  });
});

describe("積立額", () => {
  it("達成率 0 / 1/3 / 2/3 / 1", () => {
    expect(contribution(0)).toBe(0);
    expect(contribution(1 / 3)).toBe(1000);
    expect(contribution(2 / 3)).toBe(2000);
    expect(contribution(1)).toBe(3000);
  });
  it("3 課題中 2 つで ¥2,000、クリア日", () => {
    const st = dayStat({ bed: DEMO_SETTINGS.targetBed, wake: null, screen: true, caffeine: false }, DEMO_SETTINGS);
    expect(st).toMatchObject({ n: 2, k: 3, clear: true, contrib: 2000 });
  });
  it("2 課題中 1 つはクリア日ではない(過半数ではない)", () => {
    const st = dayStat({ ...empty, screen: true }, settings(["screen", "caffeine"]));
    expect(st).toMatchObject({ n: 1, k: 2, clear: false, contrib: 1500 });
  });
});

describe("30 日のシミュレーション(プロトタイプの demo と同じ値)", () => {
  const sim = simulate(DEMO_RECORDS, DEMO_SETTINGS);
  it("30 日分ある", () => {
    expect(sim).toHaveLength(30);
  });
  it("複利の分は約 ¥79(誤差 ±¥1)", () => {
    expect(Math.abs(sim[29]!.comp - 79)).toBeLessThanOrEqual(1);
  });
  it("元本 = 毎日の積立額の合計。内訳は評価額に一致する", () => {
    const last = sim[29]!;
    expect(last.principal).toBe(sim.reduce((a, d) => a + d.c, 0));
    expect(last.value - last.principal).toBeCloseTo(last.G, 6);
    expect(last.comp + last.g1 + last.principal).toBeCloseTo(last.value, 6);
  });
  it("世界株式の最大下落は約 −14.4%(誤差 ±0.1 ポイント)、8〜18 日目", () => {
    const r = reveal(sim, "bal");
    expect(Math.abs(r.maxDD * 100 - -14.4)).toBeLessThanOrEqual(0.1);
    expect(r.peakDay).toBeGreaterThanOrEqual(7);
    expect(r.troughDay).toBeLessThanOrEqual(18);
  });
  it("答え合わせの 3 区間は、積立した日を漏れなく数える", () => {
    const r = reveal(sim, "bal");
    const days = r.groups.reduce((a, g) => a + g.days, 0);
    expect(days).toBe(sim.filter((d) => d.c > 0).length);
  });
});

describe("記録が欠けても壊れない", () => {
  it("全部 null / 空配列でも 30 日分返り、積立は 0", () => {
    for (const recs of [[], Array(30).fill(null)] as (DayRecord | null)[][]) {
      const sim = simulate(recs, DEMO_SETTINGS);
      expect(sim).toHaveLength(30);
      expect(sim[29]).toMatchObject({ principal: 0, value: 0, comp: 0, loss: 0 });
    }
  });
  it("途中が欠けた日は積立だけ止まり、資産は減らさない(元本割れなし)", () => {
    const recs: (DayRecord | null)[] = DEMO_RECORDS.map((r, i) => (i >= 10 && i < 15 ? null : r));
    const sim = simulate(recs, DEMO_SETTINGS);
    expect(sim[12]!.c).toBe(0);
    expect(sim[12]!.principal).toBe(sim[9]!.principal);
    expect(reveal(sim, "bal").groups.every((g) => g.ret === null || Number.isFinite(g.ret))).toBe(true);
  });
  it("madRange は 3 日未満なら null", () => {
    const recs: (DayRecord | null)[] = [{ ...empty, bed: 10 }, null, { ...empty, bed: 20 }];
    expect(madRange(recs, 0, 2, 0)).toBeNull();
    expect(madRange([...recs, { ...empty, bed: 30 }], 0, 3, 0)).toBe(20);
  });
});

describe("週ごとの集計", () => {
  const sim = simulate(DEMO_RECORDS, DEMO_SETTINGS);
  it("30 日は 5 週(最後は 2 日)", () => {
    const w = weeklySummary(DEMO_RECORDS, sim, DEMO_SETTINGS.targetBed, 30);
    expect(w).toHaveLength(5);
    expect([w[4]!.from, w[4]!.to]).toEqual([28, 29]);
  });
  it("5 日クリアで達成、4 日では達成でない", () => {
    const w = weeklySummary(DEMO_RECORDS, sim, DEMO_SETTINGS.targetBed, 30);
    for (const x of w) expect(x.achieved).toBe(x.clearDays >= 5);
  });
  it("経過日数が 0 なら空。途中の週は経過日まで", () => {
    expect(weeklySummary(DEMO_RECORDS, sim, 0, 0)).toEqual([]);
    const w = weeklySummary(DEMO_RECORDS, sim, DEMO_SETTINGS.targetBed, 10);
    expect(w.map((x) => x.to)).toEqual([6, 9]);
  });
});
