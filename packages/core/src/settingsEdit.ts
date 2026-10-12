import type { TaskKey } from "./types";

export const TASK_MIN = 2;
export const TASK_MAX = 3;

/** 行動課題のチェックを切り替える。2〜3 個の範囲を出るときは、変えずに理由を返す。 */
export function toggleTask(
  tasks: readonly TaskKey[],
  task: TaskKey,
): { ok: true; tasks: TaskKey[] } | { ok: false; error: string } {
  if (tasks.includes(task)) {
    if (tasks.length <= TASK_MIN) return { ok: false, error: `課題は${TASK_MIN}個以上、選んでください。` };
    return { ok: true, tasks: tasks.filter((t) => t !== task) };
  }
  if (tasks.length >= TASK_MAX) return { ok: false, error: `課題は${TASK_MAX}個までです。先に1つ外してください。` };
  // 並びは、bed → wake → screen → caffeine の順にそろえる
  const order: TaskKey[] = ["bed", "wake", "screen", "caffeine"];
  return { ok: true, tasks: order.filter((t) => t === task || tasks.includes(t)) };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 目標時刻('HH:MM')の形を確かめる。保存は 'HH:MM' の 2 桁で行う。 */
export function normalizeTime(input: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const t = `${m[1]!.padStart(2, "0")}:${m[2]}`;
  return TIME_RE.test(t) ? t : null;
}

/** 開始日の形と実在を確かめる。空文字は「未設定」(null)として返す。形が悪ければ undefined。 */
export function normalizeStartDate(input: string): string | null | undefined {
  const t = input.trim();
  if (t === "") return null;
  if (!DATE_RE.test(t)) return undefined;
  const [y, m, d] = t.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  return dt.getFullYear() === y && dt.getMonth() === m! - 1 && dt.getDate() === d ? t : undefined;
}
