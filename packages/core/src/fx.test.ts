import { describe, expect, it } from "vitest";
import { DAYS } from "./constants";
import { DEMO_RECORDS, DEMO_SETTINGS } from "./fixtures";
import {
  FX_RATES,
  applyPnl,
  axisNow,
  fxPnl,
  gauge,
  gaugeLevel,
  grantFund,
  hasRateFor,
  isNightLocked,
  orderLimit,
  reviewByGauge,
  settle,
  shouldSuggestRest,
  stopLine,
  validateOrder,
  type FxTrade,
  type OrderContext,
} from "./fx";
import { ax } from "./time";
import type { DayRecord } from "./types";

const rec = (bed: string): DayRecord => ({ bed: ax(bed), wake: null, screen: false, caffeine: false });
const TB = DEMO_SETTINGS.targetBed; // 23:30
const TW = DEMO_SETTINGS.targetWake; // 06:30

describe("判断力ゲージ", () => {
  it("記録が 3 日未満なら 50", () => {
    expect(gauge([rec("23:30"), rec("23:30")], 1, TB)).toBe(50);
    expect(gauge([], 0, TB)).toBe(50);
  });
  it("目標どおりなら 100、90 分以上ズレなら 0", () => {
    expect(gauge([rec("23:30"), rec("23:30"), rec("23:30")], 2, TB)).toBe(100);
    expect(gauge([rec("01:00"), rec("01:00"), rec("01:00")], 2, TB)).toBe(0);
    expect(gauge([rec("03:00"), rec("03:00"), rec("03:00")], 2, TB)).toBe(0);
  });
  it("ズレ 45 分なら 50", () => {
    expect(gauge([rec("00:15"), rec("00:15"), rec("00:15")], 2, TB)).toBe(50);
  });
  it("直近 7 日だけを見る", () => {
    const rs = [rec("03:00"), ...Array.from({ length: 7 }, () => rec("23:30"))];
    expect(gauge(rs, 7, TB)).toBe(100);
  });
  it("睡眠の結果(起床)は使わない", () => {
    const a = [rec("23:30"), rec("23:30"), rec("23:30")];
    const b = a.map((r) => ({ ...r, wake: ax("11:00") }));
    expect(gauge(b, 2, TB)).toBe(gauge(a, 2, TB));
  });
  it("レベルの境界", () => {
    expect(gaugeLevel(70)).toBe("high");
    expect(gaugeLevel(69)).toBe("mid");
    expect(gaugeLevel(40)).toBe("mid");
    expect(gaugeLevel(39)).toBe("low");
  });
  it("デモデータで 0〜100 に収まる", () => {
    for (let i = 0; i < DAYS; i++) {
      const g = gauge(DEMO_RECORDS, i, TB);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(100);
    }
  });
});

describe("夜間ロック(目標 23:30 / 06:30 → 21:30〜07:30)", () => {
  const locked = (t: string) => isNightLocked(ax(t), TB, TW);
  it("日中は開ける", () => {
    expect(locked("12:00")).toBe(false);
    expect(locked("21:29")).toBe(false);
    expect(locked("07:30")).toBe(false);
  });
  it("就寝 2 時間前〜起床 1 時間後はロック", () => {
    expect(locked("21:30")).toBe(true);
    expect(locked("00:00")).toBe(true);
    expect(locked("07:29")).toBe(true);
  });
  it("20:00 より前に食い込む設定でもロックできる(目標就寝 21:00 → 19:00 から)", () => {
    const l = (t: string) => isNightLocked(ax(t), ax("21:00"), TW);
    expect(l("18:59")).toBe(false);
    expect(l("19:00")).toBe(true);
    expect(l("19:30")).toBe(true);
  });
  it("Date から軸の分を出せる", () => {
    expect(axisNow(new Date(2026, 9, 11, 21, 30))).toBe(ax("21:30"));
  });
});

describe("注文額の上限", () => {
  it("資金の 20%、¥1,000 刻み", () => {
    expect(orderLimit(10000, 80)).toBe(2000);
    expect(orderLimit(15000, 80)).toBe(3000);
    expect(orderLimit(12500, 80)).toBe(2000);
    expect(orderLimit(50000, 50)).toBe(10000);
  });
  it("ゲージが低い日は半分(刻みに切り下げ)", () => {
    expect(orderLimit(10000, 20)).toBe(1000);
    expect(orderLimit(15000, 20)).toBe(1000);
    expect(orderLimit(50000, 0)).toBe(5000);
  });
  it("資金が少なすぎると 0", () => {
    expect(orderLimit(4000, 80)).toBe(0);
    expect(orderLimit(0, 80)).toBe(0);
  });
});

describe("注文の検証", () => {
  const ctx: OrderContext = {
    fund: 10000,
    gauge: 80,
    nowAxis: ax("12:00"),
    targetBed: TB,
    targetWake: TW,
    orderedToday: false,
    confirmed: false,
  };
  const ok = { side: "buy", amount: 2000, stopPct: 1 } as const;
  it("条件が揃えば通る", () => {
    expect(validateOrder(ok, ctx)).toEqual([]);
  });
  it("夜間は通らない", () => {
    expect(validateOrder(ok, { ...ctx, nowAxis: ax("22:00") })).toContain("locked");
  });
  it("1 日 1 回まで", () => {
    expect(validateOrder(ok, { ...ctx, orderedToday: true })).toContain("already_ordered");
  });
  it("上限超え・刻み違い・0 以下", () => {
    expect(validateOrder({ ...ok, amount: 3000 }, ctx)).toContain("over_limit");
    expect(validateOrder({ ...ok, amount: 1500 }, ctx)).toContain("bad_amount");
    expect(validateOrder({ ...ok, amount: 0 }, ctx)).toContain("bad_amount");
    expect(validateOrder({ ...ok, amount: -1000 }, ctx)).toContain("bad_amount");
  });
  it("損切りは 3 択のみ", () => {
    expect(validateOrder({ ...ok, stopPct: 3 as never }, ctx)).toContain("bad_stop");
  });
  it("資金が足りないと no_fund", () => {
    expect(validateOrder(ok, { ...ctx, fund: 0 })).toContain("no_fund");
  });
  it("ゲージ低: 確認ステップ前は通らず、済めば半額上限で通る", () => {
    const low = { ...ctx, gauge: 20 };
    expect(validateOrder({ ...ok, amount: 1000 }, low)).toEqual(["need_confirm"]);
    expect(validateOrder({ ...ok, amount: 1000 }, { ...low, confirmed: true })).toEqual([]);
    expect(validateOrder(ok, { ...low, confirmed: true })).toContain("over_limit");
  });
});

describe("決済と損益", () => {
  it("損益の式(買い・売り)", () => {
    expect(fxPnl(2000, 150, 151.5, "buy")).toBe(20);
    expect(fxPnl(2000, 150, 151.5, "sell")).toBe(-20);
    expect(fxPnl(2000, 150, 148.5, "sell")).toBe(20);
  });
  it("損切りライン", () => {
    expect(stopLine(150, "buy", 1)).toBeCloseTo(148.5);
    expect(stopLine(150, "sell", 2)).toBeCloseTo(153);
  });
  it("損切りに届かなければ終値で決済", () => {
    const s = settle({ side: "buy", amount: 2000, stopPct: 1 }, 150, 149);
    expect(s.reason).toBe("close");
    expect(s.rate).toBe(149);
    expect(s.pnl).toBe(-13);
  });
  it("終値が損切りラインを超えたら、ラインで決済(買い)", () => {
    const s = settle({ side: "buy", amount: 2000, stopPct: 1 }, 150, 146);
    expect(s.reason).toBe("stop");
    expect(s.rate).toBeCloseTo(148.5);
    expect(s.pnl).toBe(-20);
  });
  it("終値が損切りラインを超えたら、ラインで決済(売り)", () => {
    const s = settle({ side: "sell", amount: 2000, stopPct: 0.5 }, 150, 155);
    expect(s.reason).toBe("stop");
    expect(s.rate).toBeCloseTo(150.75);
    expect(s.pnl).toBe(-10);
  });
  it("損失は注文額 × 損切り幅を超えない", () => {
    for (const side of ["buy", "sell"] as const) {
      const s = settle({ side, amount: 2000, stopPct: 2 }, 150, side === "buy" ? 100 : 200);
      expect(s.pnl).toBe(-40);
    }
  });
  it("仮想レートは 150 付近で、日数ぶんある", () => {
    expect(FX_RATES).toHaveLength(DAYS + 1);
    expect(Math.min(...FX_RATES)).toBeGreaterThan(145);
    expect(Math.max(...FX_RATES)).toBeLessThan(155);
    expect(hasRateFor(0)).toBe(true);
    expect(hasRateFor(DAYS - 1)).toBe(true);
    expect(hasRateFor(DAYS)).toBe(false);
  });
});

describe("資金", () => {
  it("付与は上限 ¥50,000", () => {
    expect(grantFund(10000)).toBe(20000);
    expect(grantFund(45000)).toBe(50000);
    expect(grantFund(50000)).toBe(50000);
  });
  it("損益を反映(0 未満にはならない)", () => {
    expect(applyPnl(10000, -40)).toBe(9960);
    expect(applyPnl(10, -40)).toBe(0);
  });
});

const trade = (pnl: number | null, g = 80): FxTrade => ({
  date: "2026-10-11",
  pair: "USD/JPY",
  side: "buy",
  amount: 1000,
  entryRate: 150,
  stopPct: 1,
  exitRate: pnl == null ? null : 150,
  reason: pnl == null ? null : "close",
  pnl,
  gauge: g,
  confirmReason: null,
  placedBy: "user",
  aiComment: null,
});

describe("休む提案と振り返り", () => {
  it("3 連敗で提案、途中に勝ちがあれば出さない", () => {
    expect(shouldSuggestRest([trade(-1), trade(-1)])).toBe(false);
    expect(shouldSuggestRest([trade(-1), trade(-1), trade(-1)])).toBe(true);
    expect(shouldSuggestRest([trade(-1), trade(5), trade(-1), trade(-1)])).toBe(false);
    expect(shouldSuggestRest([trade(5), trade(-1), trade(-1), trade(-1)])).toBe(true);
  });
  it("決済前の取引は連敗に数えない", () => {
    expect(shouldSuggestRest([trade(-1), trade(-1), trade(null)])).toBe(false);
  });
  it("ゲージ別の集計。10 件未満は参考値", () => {
    const r = reviewByGauge([trade(10, 80), trade(-20, 80), trade(30, 50), trade(-5, 10), trade(null, 10)]);
    expect(r.total).toBe(4);
    expect(r.isReference).toBe(true);
    expect(r.byLevel.map((s) => s.level)).toEqual(["high", "mid", "low"]);
    expect(r.byLevel[0]).toMatchObject({ count: 2, winRate: 0.5, avgPnl: -5 });
    expect(r.byLevel[1]).toMatchObject({ count: 1, winRate: 1, avgPnl: 30 });
    expect(r.byLevel[2]).toMatchObject({ count: 1, winRate: 0, avgPnl: -5 });
  });
  it("取引がない区分は null、10 件以上で参考値が外れる", () => {
    expect(reviewByGauge([]).byLevel[0]).toEqual({ level: "high", count: 0, winRate: null, avgPnl: null });
    expect(reviewByGauge(Array.from({ length: 10 }, () => trade(1))).isReference).toBe(false);
  });
});
