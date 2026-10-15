import { DAYS } from "./constants";
import { daysBetween } from "./date";
import {
  FX_RATES,
  FX_START_FUND,
  applyPnl,
  gauge,
  gaugeLevel,
  grantFund,
  isNightLocked,
  needsConfirm,
  orderLimit,
  reviewByGauge,
  settle,
  shouldSuggestRest,
  type FxReview,
  type FxTrade,
  type GaugeLevel,
} from "./fx";
import { simulate } from "./simulate";
import type { DayRecord, Settings } from "./types";
import { weeklySummary } from "./weekly";

/** 保存してある注文(決済前の形)。決済の結果は、レートから毎回計算する。 */
export type FxOrder = Omit<FxTrade, "exitRate" | "reason" | "pnl">;

/** 取引を決済する。決済に使う翌日の終値は FX_RATES から取る。 */
export function resolveOrder(order: FxOrder, startDate: string, today: string): FxTrade {
  const day = daysBetween(startDate, order.date);
  const next = FX_RATES[day + 1];
  if (next === undefined || daysBetween(startDate, today) < day + 1) {
    return { ...order, exitRate: null, reason: null, pnl: null };
  }
  const s = settle(order, order.entryRate, next);
  return { ...order, exitRate: s.rate, reason: s.reason, pnl: s.pnl };
}

/**
 * チャレンジ資金の残高。付与(週 5 日クリアした週が終わった翌日)と、決済の損益を、日の順に反映する。
 * 同じ日は付与を先にする。
 */
export function fundBalance(
  grantDays: readonly number[],
  settled: readonly { day: number; pnl: number }[],
): number {
  const events = [
    ...grantDays.map((day) => ({ day, order: 0, pnl: 0 })),
    ...settled.map((t) => ({ day: t.day, order: 1, pnl: t.pnl })),
  ].sort((a, b) => a.day - b.day || a.order - b.order);
  let fund = FX_START_FUND;
  for (const e of events) fund = e.order === 0 ? grantFund(fund) : applyPnl(fund, e.pnl);
  return fund;
}

export type FxPhase = "not_started" | "active" | "ended";

export interface FxInput {
  startDate: string | null;
  /** 今日の起床日 YYYY-MM-DD */
  today: string;
  /** 20:00 起点の分 */
  nowAxis: number;
  /** 開始日からの 30 日分(記録がない日は null) */
  records: readonly (DayRecord | null)[];
  settings: Settings;
  orders: readonly FxOrder[];
}

export interface FxState {
  phase: FxPhase;
  /** 開始日から数えた今日(0 始まり)。開始前は null */
  dayIndex: number | null;
  /** 今日の終値(仮想)。注文できない日は null */
  rate: number | null;
  gauge: number;
  level: GaugeLevel;
  needsConfirm: boolean;
  locked: boolean;
  fund: number;
  /** 今日の注文額の上限 */
  limit: number;
  orderedToday: boolean;
  /** 日付の昇順。決済前のものは pnl が null */
  trades: FxTrade[];
  /** 保有中(決済前)の取引 */
  open: FxTrade | null;
  restSuggested: boolean;
  review: FxReview;
}

/** チャレンジ画面に必要な状態を、まとめて計算する。画面には計算を置かない。 */
export function fxState(input: FxInput): FxState {
  const { startDate, today, nowAxis, records, settings, orders } = input;
  const dayIndex = startDate === null ? null : daysBetween(startDate, today);
  const phase: FxPhase =
    dayIndex === null || dayIndex < 0 ? "not_started" : dayIndex >= DAYS ? "ended" : "active";

  const trades =
    startDate === null
      ? []
      : orders
          .map((o) => resolveOrder(o, startDate, today))
          .sort((a, b) => a.date.localeCompare(b.date));

  // 付与: 7 日そろって週 5 日クリアした週の、翌日
  const today0 = dayIndex ?? 0;
  const sim = simulate(records, settings);
  const grantDays = weeklySummary(records, sim, settings.targetBed, DAYS)
    .filter((w) => w.achieved && w.to - w.from === 6 && today0 > w.to)
    .map((w) => w.to + 1);
  const settled = startDate === null
    ? []
    : trades.flatMap((t) => (t.pnl === null ? [] : [{ day: daysBetween(startDate, t.date) + 1, pnl: t.pnl }]));
  const fund = fundBalance(grantDays, settled);

  const idx = Math.min(Math.max(dayIndex ?? 0, 0), DAYS - 1);
  const g = gauge(records, idx, settings.targetBed);
  return {
    phase,
    dayIndex,
    rate: phase === "active" ? (FX_RATES[dayIndex!] ?? null) : null,
    gauge: g,
    level: gaugeLevel(g),
    needsConfirm: needsConfirm(g),
    locked: isNightLocked(nowAxis, settings.targetBed, settings.targetWake),
    fund,
    limit: orderLimit(fund, g),
    orderedToday: trades.some((t) => t.date === today),
    trades,
    open: trades.find((t) => t.pnl === null) ?? null,
    restSuggested: shouldSuggestRest(trades),
    review: reviewByGauge(trades),
  };
}
