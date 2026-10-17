export type RateDirection = "up" | "down" | "flat";

export interface RateChange {
  dir: RateDirection;
  /** 前日の終値との差(円)。小数第 2 位までに丸める */
  diff: number;
  /** 前日比(%)。小数第 2 位までに丸める */
  pct: number;
}

/** day 日目(0 始まり)の終値の、前日比。1 日目(前日がない)は null。 */
export function rateChange(rates: readonly number[], day: number): RateChange | null {
  const cur = rates[day];
  const prev = rates[day - 1];
  if (cur === undefined || prev === undefined) return null;
  const diff = Math.round((cur - prev) * 100) / 100;
  const pct = Math.round(((cur - prev) / prev) * 10000) / 100;
  return { dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat", diff, pct };
}
