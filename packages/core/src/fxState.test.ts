import { describe, expect, it } from "vitest";
import { DEMO_RECORDS, DEMO_SETTINGS } from "./fixtures";
import { FX_RATES, orderLimit } from "./fx";
import { fundBalance, fxState, resolveOrder, type FxInput, type FxOrder } from "./fxState";
import { addDays } from "./date";
import { ax } from "./time";

const START = "2026-10-01";
const order = (day: number, over: Partial<FxOrder> = {}): FxOrder => ({
  date: addDays(START, day),
  pair: "USD/JPY",
  side: "buy",
  amount: 2000,
  entryRate: FX_RATES[day]!,
  stopPct: 1,
  gauge: 80,
  confirmReason: null,
  ...over,
});
const input = (day: number, over: Partial<FxInput> = {}): FxInput => ({
  startDate: START,
  today: addDays(START, day),
  nowAxis: ax("12:00"),
  records: DEMO_RECORDS,
  settings: DEMO_SETTINGS,
  orders: [],
  ...over,
});

describe("注文の決済", () => {
  it("翌日になるまでは決済前", () => {
    const t = resolveOrder(order(3), START, addDays(START, 3));
    expect(t.pnl).toBeNull();
    expect(t.exitRate).toBeNull();
  });
  it("翌日になったら、翌日の終値で決済", () => {
    const t = resolveOrder(order(3), START, addDays(START, 4));
    expect(t.exitRate).toBe(FX_RATES[4]);
    expect(t.reason).toBe("close");
    expect(t.pnl).toBe(Math.round(2000 * (FX_RATES[4]! / FX_RATES[3]! - 1)));
  });
  it("損切りに届く日(買い・損切り 0.5%)は、ラインで決済", () => {
    // 5日目 150.55 → 6日目 149.20 は −0.9%
    const t = resolveOrder(order(5, { stopPct: 0.5 }), START, addDays(START, 6));
    expect(t.reason).toBe("stop");
    expect(t.exitRate).toBeCloseTo(FX_RATES[5]! * 0.995);
  });
});

describe("資金", () => {
  it("初期 ¥10,000", () => expect(fundBalance([], [])).toBe(10000));
  it("付与と損益を日の順に反映、上限 ¥50,000", () => {
    expect(fundBalance([7], [{ day: 3, pnl: -100 }])).toBe(19900);
    expect(fundBalance([7, 14, 21, 28, 35], [])).toBe(50000);
  });
});

describe("チャレンジの状態", () => {
  it("開始日がなければ not_started", () => {
    const s = fxState(input(0, { startDate: null }));
    expect(s.phase).toBe("not_started");
    expect(s.rate).toBeNull();
  });
  it("開始前は not_started、30日後は ended", () => {
    expect(fxState(input(-1)).phase).toBe("not_started");
    expect(fxState(input(0)).phase).toBe("active");
    expect(fxState(input(29)).phase).toBe("active");
    expect(fxState(input(30)).phase).toBe("ended");
    expect(fxState(input(30)).rate).toBeNull();
  });
  it("今日のレート・上限・夜間ロック", () => {
    const s = fxState(input(10));
    expect(s.rate).toBe(FX_RATES[10]);
    expect(s.fund).toBeGreaterThanOrEqual(10000);
    expect(s.limit).toBe(orderLimit(s.fund, s.gauge));
    expect(s.locked).toBe(false);
    expect(fxState(input(10, { nowAxis: ax("23:00") })).locked).toBe(true);
  });
  it("記録がなければ、ゲージは 50(中)", () => {
    const s = fxState(input(5, { records: [] }));
    expect(s.gauge).toBe(50);
    expect(s.level).toBe("mid");
    expect(s.fund).toBe(10000);
  });
  it("今日注文済みなら orderedToday、保有中は open", () => {
    const s = fxState(input(8, { orders: [order(8)] }));
    expect(s.orderedToday).toBe(true);
    expect(s.open?.date).toBe(addDays(START, 8));
    const s2 = fxState(input(9, { orders: [order(8)] }));
    expect(s2.orderedToday).toBe(false);
    expect(s2.open).toBeNull();
    expect(s2.trades[0]!.pnl).not.toBeNull();
  });
  it("決済した損益が資金に入る", () => {
    const s = fxState(input(9, { records: [], orders: [order(8)] }));
    expect(s.fund).toBe(10000 + s.trades[0]!.pnl!);
  });
  it("週 5 日クリアした週の翌日に +¥10,000(デモは 1 週目がクリア)", () => {
    const before = fxState(input(6, { records: DEMO_RECORDS }));
    const after = fxState(input(7, { records: DEMO_RECORDS }));
    expect(after.fund - before.fund).toBeGreaterThanOrEqual(0);
    const cleared = fxState(input(29, { records: DEMO_RECORDS })).fund;
    expect(cleared).toBeLessThanOrEqual(50000);
  });
});
