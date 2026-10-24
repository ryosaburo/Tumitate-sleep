import { DAYS } from "./constants";
import { toAxisMinutes } from "./time";
import type { DayRecord } from "./types";
import { madRange } from "./weekly";

// ---- 定数(計画書 §6) ----

/** チャレンジ資金の初期値(仮想円)。 */
export const FX_START_FUND = 10000;
/** 週 5 日クリアで付与する額。 */
export const FX_GRANT = 10000;
/** チャレンジ資金の上限。付与はここまで。 */
export const FX_MAX_FUND = 50000;
/** 注文額の上限は資金の 20%(レバレッジなし)。 */
export const FX_ORDER_RATIO = 0.2;
/** 注文額の刻み。 */
export const FX_ORDER_STEP = 1000;
/** 損切り幅(%)の選択肢。必須。 */
export const FX_STOP_PCTS = [0.5, 1, 2] as const;
export type StopPct = (typeof FX_STOP_PCTS)[number];

/** 判断力ゲージ: MAD7 がこの分数以上ズレていればゼロ。 */
export const GAUGE_MAD_MAX = 90;
/** 記録が足りないときのゲージ。 */
export const GAUGE_DEFAULT = 50;
/** 目標の就寝〜起床がこの分数未満だと、ゲージの上限を下げはじめる(6 時間)。 */
export const GAUGE_SPAN_FULL = 360;
/** 目標の間隔がこの分数以下なら、上限は最小(4 時間)。 */
export const GAUGE_SPAN_MIN = 240;
/** ゲージの上限の下限(0.6)。 */
export const GAUGE_SPAN_FLOOR = 0.6;
export const GAUGE_HIGH = 70;
/** これ未満が「低」。確認ステップと注文額の半減が入る。 */
export const GAUGE_LOW = 40;

/** 夜間ロック: 目標就寝のこの分前から。 */
export const LOCK_BEFORE_BED = 120;
/** 夜間ロック: 目標起床のこの分後まで。 */
export const LOCK_AFTER_WAKE = 60;

/** 取引がこの件数に満たない成績は「参考値」。 */
export const FX_REFERENCE_MIN = 10;
/** 連続でこの回数損失になったら「今日は休む」を提案する。 */
export const FX_REST_STREAK = 3;

/** 確認ステップの理由(§6.3)。 */
export const FX_REASONS = [
  "なんとなく",
  "取り返したい",
  "ニュースを見た",
  "予想に自信がある",
  "練習",
] as const;
export type FxReason = (typeof FX_REASONS)[number];
/** 確認ステップのカウントダウン(秒)。 */
export const FX_CONFIRM_SECONDS = 10;

/**
 * 仮想の USD/JPY 日足の終値(長さ DAYS + 1)。150.00 付近の架空の値。
 * i 日目に注文すると [i] で約定し、翌日 [i + 1] で決済する。損切りに届く日も含む。
 */
export const FX_RATES: readonly number[] = [
  150.0, 150.42, 149.85, 150.3, 151.1, 150.55, 149.2, 149.65, 150.4, 151.35, 152.2, 151.4, 150.1,
  148.9, 149.5, 150.2, 149.7, 150.9, 151.6, 150.8, 150.25, 149.4, 148.5, 149.3, 150.05, 150.6,
  151.2, 150.7, 150.15, 150.85, 151.3,
];

// ---- 判断力ゲージ ----

export type GaugeLevel = "high" | "mid" | "low";

/**
 * 目標の就寝〜起床の間隔による、ゲージの上限の係数(0.6〜1)。
 * 6 時間以上は 1。それより短いと直線で下がり、4 時間以下で 0.6。
 * 実際の睡眠ではなく、設定した目標だけを見る。
 */
export function sleepSpanFactor(targetBed: number, targetWake: number): number {
  const span = targetWake - targetBed;
  if (span >= GAUGE_SPAN_FULL) return 1;
  if (span <= GAUGE_SPAN_MIN) return GAUGE_SPAN_FLOOR;
  const t = (span - GAUGE_SPAN_MIN) / (GAUGE_SPAN_FULL - GAUGE_SPAN_MIN);
  return GAUGE_SPAN_FLOOR + (1 - GAUGE_SPAN_FLOOR) * t;
}

/**
 * 判断力ゲージ(0〜100)。dayIndex 日目を含む直近 7 日の就寝のズレだけで決める。
 * 睡眠時間やスコアは使わない。記録のある日が 3 日未満なら 50。
 * targetWake を渡すと、目標の間隔が短いときに上限を下げる(sleepSpanFactor)。
 */
export function gauge(
  records: readonly (DayRecord | null)[],
  dayIndex: number,
  targetBed: number,
  targetWake?: number,
): number {
  const mad = madRange(records, Math.max(0, dayIndex - 6), dayIndex, targetBed);
  if (mad == null) return GAUGE_DEFAULT;
  const base = Math.min(Math.max(1 - mad / GAUGE_MAD_MAX, 0), 1);
  const cap = targetWake == null ? 1 : sleepSpanFactor(targetBed, targetWake);
  return Math.round(100 * base * cap);
}

export function gaugeLevel(g: number): GaugeLevel {
  if (g >= GAUGE_HIGH) return "high";
  if (g >= GAUGE_LOW) return "mid";
  return "low";
}

/** ゲージが低い日は、確認ステップを挟む。 */
export function needsConfirm(g: number): boolean {
  return gaugeLevel(g) === "low";
}

// ---- 夜間ロック ----

/** Date から、20:00 起点の分を出す(端末のローカル時間)。現在時刻は呼び出し側が渡す。 */
export function axisNow(d: Date): number {
  return toAxisMinutes(d.getHours(), d.getMinutes());
}

/**
 * 夜間ロック中か。目標就寝の 2 時間前〜目標起床の 1 時間後(終わりの時刻ちょうどは解除)。
 * nowAxis は 20:00 起点の分。
 */
export function isNightLocked(nowAxis: number, targetBed: number, targetWake: number): boolean {
  const start = targetBed - LOCK_BEFORE_BED;
  const end = targetWake + LOCK_AFTER_WAKE;
  // 開始が 20:00 より前に食い込む設定でも、前日側の分として判定できるよう 1 日ずらしても見る
  return [nowAxis, nowAxis - 1440].some((t) => t >= start && t < end);
}

// ---- 注文 ----

export type Side = "buy" | "sell";

export interface FxOrderInput {
  side: Side;
  /** 注文額(円) */
  amount: number;
  stopPct: StopPct;
}

/** 注文額の上限。資金の 20%、¥1,000 刻み。ゲージが低い日は、その半分(刻みに切り下げ)。 */
export function orderLimit(fund: number, g: number): number {
  const cap = Math.floor((fund * FX_ORDER_RATIO) / FX_ORDER_STEP) * FX_ORDER_STEP;
  if (!needsConfirm(g)) return cap;
  return Math.floor(cap / 2 / FX_ORDER_STEP) * FX_ORDER_STEP;
}

export type OrderError =
  | "locked"
  | "already_ordered"
  | "no_fund"
  | "bad_amount"
  | "over_limit"
  | "bad_stop"
  | "need_confirm"
  /** 開始前・期間終了などで、今日のレートがない(validateOrder ではなく、状態を見る側が付ける) */
  | "no_rate";

export interface OrderContext {
  fund: number;
  gauge: number;
  /** 20:00 起点の分 */
  nowAxis: number;
  targetBed: number;
  targetWake: number;
  /** 今日すでに注文したか */
  orderedToday: boolean;
  /** 確認ステップ(理由・10 秒・再確認)を終えたか */
  confirmed: boolean;
}

/** 注文できるか確かめる。問題がなければ空の配列。 */
export function validateOrder(order: FxOrderInput, ctx: OrderContext): OrderError[] {
  const errors: OrderError[] = [];
  if (isNightLocked(ctx.nowAxis, ctx.targetBed, ctx.targetWake)) errors.push("locked");
  if (ctx.orderedToday) errors.push("already_ordered");
  const limit = orderLimit(ctx.fund, ctx.gauge);
  if (limit <= 0) errors.push("no_fund");
  else if (
    !Number.isInteger(order.amount) ||
    order.amount < FX_ORDER_STEP ||
    order.amount % FX_ORDER_STEP !== 0
  ) {
    errors.push("bad_amount");
  } else if (order.amount > limit) errors.push("over_limit");
  if (!FX_STOP_PCTS.includes(order.stopPct)) errors.push("bad_stop");
  if (needsConfirm(ctx.gauge) && !ctx.confirmed) errors.push("need_confirm");
  return errors;
}

// ---- 決済 ----

export type SettleReason = "close" | "stop";

export interface Settlement {
  /** 決済レート */
  rate: number;
  reason: SettleReason;
  /** 損益(円。整数に丸める) */
  pnl: number;
}

/** 損切りライン。買いは下、売りは上。 */
export function stopLine(entryRate: number, side: Side, stopPct: number): number {
  return side === "buy" ? entryRate * (1 - stopPct / 100) : entryRate * (1 + stopPct / 100);
}

/** 損益 = 注文額 × (決済レート ÷ 約定レート − 1) × (買い: +1 / 売り: −1)。 */
export function fxPnl(amount: number, entryRate: number, exitRate: number, side: Side): number {
  const dir = side === "buy" ? 1 : -1;
  return Math.round(amount * (exitRate / entryRate - 1) * dir);
}

/**
 * 翌日の終値で決済する。終値が損切りラインを超えていたら、ラインのレートで決済する。
 * (ちょうどラインに届いた場合も損切り扱い)
 */
export function settle(
  order: FxOrderInput,
  entryRate: number,
  nextClose: number,
): Settlement {
  const line = stopLine(entryRate, order.side, order.stopPct);
  const hit = order.side === "buy" ? nextClose <= line : nextClose >= line;
  const rate = hit ? line : nextClose;
  return { rate, reason: hit ? "stop" : "close", pnl: fxPnl(order.amount, entryRate, rate, order.side) };
}

// ---- 取引ログ・資金 ----

export interface FxTrade {
  /** 注文した日(起床日 YYYY-MM-DD) */
  date: string;
  pair: "USD/JPY";
  side: Side;
  amount: number;
  entryRate: number;
  stopPct: StopPct;
  /** 決済前は null */
  exitRate: number | null;
  reason: SettleReason | null;
  pnl: number | null;
  /** 注文したときのゲージ */
  gauge: number;
  /** 確認ステップで選んだ理由。確認ステップがない日は null */
  confirmReason: FxReason | null;
  /** だれが注文したか。「AI にまかせる」を選んだ日は ai(計画書 §6.6) */
  placedBy: "user" | "ai";
  /** AI の理由(日本語、80字まで)。AI でなければ null */
  aiComment: string | null;
}

/** 付与。週 5 日クリアした翌週に ¥10,000、上限 ¥50,000。 */
export function grantFund(fund: number): number {
  return Math.min(fund + FX_GRANT, FX_MAX_FUND);
}

/** 決済済みの取引を、資金に反映する。 */
export function applyPnl(fund: number, pnl: number): number {
  return Math.max(fund + pnl, 0);
}

/** 決済済みの直近 FX_REST_STREAK 件がすべて損失なら、「今日は休む」を提案する(強制はしない)。 */
export function shouldSuggestRest(trades: readonly FxTrade[]): boolean {
  const done = trades.filter((t) => t.pnl != null);
  if (done.length < FX_REST_STREAK) return false;
  return done.slice(-FX_REST_STREAK).every((t) => t.pnl! < 0);
}

export interface GaugeStat {
  level: GaugeLevel;
  count: number;
  /** 勝った割合(0〜1)。取引がなければ null */
  winRate: number | null;
  /** 平均損益(円)。取引がなければ null */
  avgPnl: number | null;
}

export interface FxReview {
  byLevel: GaugeStat[];
  /** 決済済みの取引の総数 */
  total: number;
  /** 10 件に満たないうちは「参考値」と表示する */
  isReference: boolean;
}

/** ゲージ別(高・中・低)の取引数・勝率・平均損益。因果は断定しない。 */
export function reviewByGauge(trades: readonly FxTrade[]): FxReview {
  const done = trades.filter((t) => t.pnl != null);
  const byLevel = (["high", "mid", "low"] as const).map((level): GaugeStat => {
    const ts = done.filter((t) => gaugeLevel(t.gauge) === level);
    const count = ts.length;
    if (count === 0) return { level, count, winRate: null, avgPnl: null };
    const wins = ts.filter((t) => t.pnl! > 0).length;
    const sum = ts.reduce((a, t) => a + t.pnl!, 0);
    return { level, count, winRate: wins / count, avgPnl: sum / count };
  });
  return { byLevel, total: done.length, isReference: done.length < FX_REFERENCE_MIN };
}

/** その日(0 始まり)に注文できるレートがあるか。翌日の終値が必要なので、最終日は不可。 */
export function hasRateFor(dayIndex: number): boolean {
  return dayIndex >= 0 && dayIndex + 1 < Math.min(FX_RATES.length, DAYS + 1);
}
