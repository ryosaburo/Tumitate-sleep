import { DAYS } from "./constants";
import { daysBetween } from "./date";
import type { DayRecord, SimDay } from "./types";

/** 開始日から数えた経過日数(1〜30)。開始日が未設定・未来なら 0。today は呼び出し側が渡す。 */
export function elapsedDays(startDate: string | null, today: string): number {
  if (startDate === null) return 0;
  const n = daysBetween(startDate, today) + 1;
  return Math.min(Math.max(n, 0), DAYS);
}

/** 保存した記録を、開始日からの 30 日分の配列にする(記録がない日は null)。simulate() に渡せる形。 */
export function simRecords(
  rows: readonly (DayRecord & { date: string })[],
  startDate: string | null,
): (DayRecord | null)[] {
  const out: (DayRecord | null)[] = Array.from({ length: DAYS }, () => null);
  if (startDate === null) return out;
  for (const r of rows) {
    const i = daysBetween(startDate, r.date);
    if (i >= 0 && i < DAYS) out[i] = { bed: r.bed, wake: r.wake, screen: r.screen, caffeine: r.caffeine };
  }
  return out;
}

const NICE_STEPS = [10000, 20000, 25000, 50000, 100000, 200000];

/** 縦軸の上限と目盛りの間隔。目盛りは 4 本以内。 */
export function niceTop(v: number): { top: number; step: number } {
  for (const step of NICE_STEPS) {
    const n = Math.ceil(v / step);
    if (n <= 4) return { top: n * step, step };
  }
  return { top: Math.ceil(v / 200000) * 200000, step: 200000 };
}

/** 資産グラフの縦軸。評価額と積立元本の最大値に、少し余白を足す。 */
export function chartTop(sim: readonly SimDay[]): { top: number; step: number } {
  let max = 1000;
  for (const s of sim) max = Math.max(max, s.value, s.principal);
  return niceTop(max * 1.04);
}
