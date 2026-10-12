import { BASE, TOL } from "./constants";
import type { DayRecord, DayStat, Settings, TaskKey } from "./types";

/** その課題を達成したか。bed / wake は自動判定、screen / caffeine は自己申告。 */
export function isDone(rec: DayRecord | null, task: TaskKey, s: Settings): boolean {
  if (!rec) return false;
  if (task === "bed") return rec.bed != null && Math.abs(rec.bed - s.targetBed) <= TOL;
  if (task === "wake") return rec.wake != null && Math.abs(rec.wake - s.targetWake) <= TOL;
  return rec[task];
}

/** 積立額 = round(3000 × 達成率 / 100) × 100。 */
export function contribution(rate: number): number {
  return Math.round((BASE * rate) / 100) * 100;
}

export function dayStat(rec: DayRecord | null, s: Settings): DayStat {
  const k = s.tasks.length;
  const n = s.tasks.filter((t) => isDone(rec, t, s)).length;
  const rate = k === 0 ? 0 : n / k;
  return { n, k, rate, clear: n > k / 2, contrib: contribution(rate) };
}
