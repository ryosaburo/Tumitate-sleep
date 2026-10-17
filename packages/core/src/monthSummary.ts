import { DAYS } from "./constants";
import { clock } from "./time";
import { madRange, weeklySummary } from "./weekly";
import type { BedTrend, DayRecord, MonthSummary, SimDay } from "./types";

/** この分数以上の差があるとき、就寝のズレが「変わった」とみなす。 */
const TREND_MIN = 10;

function mean(values: number[]): number | null {
  return values.length >= 3 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * 経過日数ぶんの、短いまとめ。行動と記録だけを扱い、睡眠の良し悪しは判定しない。
 * elapsed が 0 のときは null。
 */
export function monthSummary(
  records: readonly (DayRecord | null)[],
  sim: readonly SimDay[],
  targetBed: number,
  elapsed: number,
): MonthSummary | null {
  const days = Math.min(Math.max(Math.floor(elapsed), 0), DAYS, sim.length);
  if (days === 0) return null;

  const used = records.slice(0, days);
  const recorded = used.filter((r) => r && (r.bed !== null || r.wake !== null)).length;
  const weeks = weeklySummary(records, sim, targetBed, days);
  const clearDays = weeks.reduce((n, w) => n + w.clearDays, 0);
  const achievedWeeks = weeks.filter((w) => w.achieved).length;

  // 初週と直近 7 日が重ならないよう、14 日以上のときだけ比べる
  const madFirst = days >= 14 ? madRange(records, 0, 6, targetBed) : null;
  const madRecent = days >= 14 ? madRange(records, days - 7, days - 1, targetBed) : null;
  let trend: BedTrend | null = null;
  if (madFirst !== null && madRecent !== null) {
    const diff = madRecent - madFirst;
    trend = diff <= -TREND_MIN ? "improved" : diff >= TREND_MIN ? "wider" : "steady";
  }

  const avgBed = mean(used.flatMap((r) => (r && r.bed !== null ? [r.bed] : [])));
  const avgWake = mean(used.flatMap((r) => (r && r.wake !== null ? [r.wake] : [])));
  const last = sim[days - 1]!;

  const lines: string[] = [];
  const span = days >= DAYS ? "この30日間" : `ここまでの ${days} 日間`;
  lines.push(
    recorded === 0
      ? `${span}は、まだ記録がありません。`
      : `${span}で ${recorded} 日を記録し、そのうち ${clearDays} 日、決めた行動を守れました。`,
  );
  if (madFirst !== null && madRecent !== null && trend !== null) {
    const a = Math.round(madFirst);
    const b = Math.round(madRecent);
    const tail =
      trend === "improved" ? "目標の就寝時刻に、そろってきました。" : trend === "wider" ? "ばらつきが、やや大きめでした。" : "ほぼ同じ水準でした。";
    lines.push(`就寝のズレは、初週の約 ${a} 分から、直近 7 日では約 ${b} 分になりました。${tail}`);
  }
  if (avgBed !== null && avgWake !== null) {
    lines.push(`平均は、就寝 ${clock(Math.round(avgBed))}、起床 ${clock(Math.round(avgWake))} でした(推定値)。`);
  }

  return {
    days,
    recorded,
    clearDays,
    achievedWeeks,
    weekCount: weeks.length,
    madFirst,
    madRecent,
    trend,
    avgBed,
    avgWake,
    principal: last.principal,
    value: last.value,
    lines,
  };
}
