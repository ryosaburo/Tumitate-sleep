import { dateKey } from "./date";
import { toAxisMinutes } from "./time";

/** 「ねる」から何時間たっていたら、途中状態を破棄するか。 */
export const PENDING_MAX_HOURS = 18;

const HOUR_MS = 3600000;

export type PendingState =
  /** 「ねる」を押していない */
  | { kind: "none" }
  /** 睡眠中(押してから 18 時間未満) */
  | { kind: "sleeping"; bedTs: number }
  /** 18 時間以上たっている。破棄して、時刻入力を促す */
  | { kind: "stale"; bedTs: number };

/** 「ねる」の途中状態を判定する。時刻は呼び出し側が渡す(ミリ秒)。 */
export function pendingState(bedTs: number | null, now: number): PendingState {
  if (bedTs === null) return { kind: "none" };
  if (now - bedTs >= PENDING_MAX_HOURS * HOUR_MS) return { kind: "stale", bedTs };
  // 未来の時刻(端末の時計のずれ)は、押していないものとして扱う
  if (bedTs > now) return { kind: "none" };
  return { kind: "sleeping", bedTs };
}

export interface WakeRecord {
  /** 起床日 'YYYY-MM-DD'(起きた時点の、端末のローカル日付) */
  date: string;
  /** 20:00 起点の分 */
  bed: number;
  wake: number;
}

/** 「おきた」を押したときの記録を作る。 */
export function wakeRecord(bedTs: number, wakeTs: number): WakeRecord {
  const bed = new Date(bedTs);
  const wake = new Date(wakeTs);
  return {
    date: dateKey(wake),
    bed: toAxisMinutes(bed.getHours(), bed.getMinutes()),
    wake: toAxisMinutes(wake.getHours(), wake.getMinutes()),
  };
}
