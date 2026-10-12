import { parseKey } from "./date";
import { ax } from "./time";

/** 起床は就寝より後で、この分以内。 */
export const EDIT_MAX_MINUTES = 960;

export interface SleepEditInput {
  /** 起床日 'YYYY-MM-DD' */
  date: string;
  /** 'HH:MM' */
  bed: string;
  wake: string;
}

export type SleepEditResult =
  | { ok: true; date: string; bed: number; wake: number }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** 時刻の修正フォームの入力を確かめる。today は端末のローカル日付 'YYYY-MM-DD'(呼び出し側が渡す)。 */
export function validateSleepEdit(input: SleepEditInput, today: string): SleepEditResult {
  if (!DATE_RE.test(input.date) || Number.isNaN(parseKey(input.date).getTime())) {
    return { ok: false, error: "日付を YYYY-MM-DD の形で入れてください。" };
  }
  if (input.date > today) return { ok: false, error: "未来の日付は記録できません。" };
  if (!TIME_RE.test(input.bed)) return { ok: false, error: "就寝時刻を HH:MM の形で入れてください。" };
  if (!TIME_RE.test(input.wake)) return { ok: false, error: "起床時刻を HH:MM の形で入れてください。" };
  const bed = ax(input.bed);
  const wake = ax(input.wake);
  if (wake <= bed) return { ok: false, error: "起床は就寝より後の時刻にしてください。" };
  if (wake - bed > EDIT_MAX_MINUTES) return { ok: false, error: "就寝から起床まで、16時間以内にしてください。" };
  return { ok: true, date: input.date, bed, wake };
}
