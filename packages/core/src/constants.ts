import type { PresetKey } from "./types";

/** 時刻の軸は 20:00 を 0 分とする。 */
export const OFF = 1200;
/** 表示範囲は 20:00〜12:00 の 960 分。 */
export const SPAN = 960;
/** 目標時刻の前後 30 分を達成とする。 */
export const TOL = 30;
/** 1 日の基準積立(仮想円)。 */
export const BASE = 3000;
/** 週にこの日数クリアすると、その週は達成。 */
export const WEEK_GOAL = 5;
/** シミュレーションの日数。 */
export const DAYS = 30;

/** 仮想の日次リターン(%)。途中に下落局面を 1 回含む学習用データ。 */
export const R_EQ: readonly number[] = [
  0.6, -0.3, 0.8, 0.4, -0.5, 0.9, 0.3, -0.8, -1.2, -0.6, 0.4, -2.1, -3.4, -2.8, -1.9, 1.1, -2.6,
  -1.4, 1.6, 2.9, 3.4, 2.1, 2.6, -0.7, 2.2, 1.5, 0.9, 1.8, -0.4, 1.3,
];
export const R_BD: readonly number[] = [
  0.05, 0.1, -0.05, 0.08, 0.05, 0.1, -0.02, 0.15, 0.2, 0.1, 0.05, 0.3, 0.35, 0.25, 0.2, -0.1, 0.3,
  0.15, 0, -0.1, -0.2, -0.05, -0.15, 0.1, -0.1, 0, 0.05, -0.05, 0.1, 0.05,
];

/** 日次リターン(%)から、1 を起点にした価格系列(長さ 31)を作る。 */
export function series(returns: readonly number[]): number[] {
  const prices = [1];
  for (const r of returns) prices.push(prices[prices.length - 1]! * (1 + r / 100));
  return prices;
}

export const PX = { eq: series(R_EQ), bd: series(R_BD) } as const;

/** 配分プリセット(世界株式 / 債券 / 現金)。 */
export const PRESETS: Record<PresetKey, { name: string; eq: number; bd: number; cash: number }> = {
  safe: { name: "守り重視", eq: 0.2, bd: 0.5, cash: 0.3 },
  bal: { name: "バランス", eq: 0.6, bd: 0.3, cash: 0.1 },
  grow: { name: "成長重視", eq: 0.8, bd: 0.15, cash: 0.05 },
};
