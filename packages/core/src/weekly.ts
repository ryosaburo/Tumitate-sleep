import { WEEK_GOAL } from "./constants";
import type { DayRecord, SimDay, WeekSummary } from "./types";

/** from〜to 日目の就寝のズレ(目標との差の絶対値)の平均。記録が 3 日未満なら null。 */
export function madRange(
  records: readonly (DayRecord | null)[],
  from: number,
  to: number,
  targetBed: number,
): number | null {
  let sum = 0;
  let n = 0;
  for (let j = from; j <= to; j++) {
    const bed = records[j]?.bed;
    if (bed != null) {
      sum += Math.abs(bed - targetBed);
      n++;
    }
  }
  return n >= 3 ? sum / n : null;
}

/**
 * 7 日ごとの集計。elapsed は経過日数(1 以上)。最後の週は途中までで数える。
 * クリア日の判定は sim[i].stat.clear を使う。
 */
export function weeklySummary(
  records: readonly (DayRecord | null)[],
  sim: readonly SimDay[],
  targetBed: number,
  elapsed: number,
): WeekSummary[] {
  const days = Math.min(Math.max(elapsed, 0), sim.length);
  const weeks: WeekSummary[] = [];
  for (let from = 0, index = 0; from < days; from += 7, index++) {
    const to = Math.min(from + 6, days - 1);
    let clearDays = 0;
    for (let i = from; i <= to; i++) if (sim[i]!.stat.clear) clearDays++;
    weeks.push({
      index,
      from,
      to,
      clearDays,
      achieved: clearDays >= WEEK_GOAL,
      mad: madRange(records, from, to, targetBed),
      endValue: sim[to]!.value,
    });
  }
  return weeks;
}
