import type { FxOrderRow, RecordRow, SettingsRow } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TASKS = ["bed", "wake", "screen", "caffeine"];
const PRESETS = ["safe", "bal", "grow"];

export function warn(message: string, detail?: unknown): void {
  console.warn(`[nekase/storage] ${message}`, detail ?? "");
}

/** 設定がまだ保存されていないときの既定値(計画書 §5.2、§5.3)。 */
export function defaultSettings(now: number): SettingsRow {
  return {
    target_bed: "23:30",
    target_wake: "06:30",
    start_date: null,
    tasks_json: JSON.stringify(["bed", "screen", "caffeine"]),
    preset: "bal",
    pending_bed_ts: null,
    updated_at: now,
  };
}

const isMinutes = (v: unknown): v is number | null =>
  v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1440);
const isFlag = (v: unknown): v is 0 | 1 => v === 0 || v === 1;
const isTime = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** 壊れた行は null を返す(呼び出し側で捨てて警告する)。 */
export function parseRecordRow(x: unknown): RecordRow | null {
  if (typeof x !== "object" || x === null) return null;
  const r = x as Record<string, unknown>;
  if (typeof r.date !== "string" || !DATE_RE.test(r.date)) return null;
  const bed = r.bed_min ?? null;
  const wake = r.wake_min ?? null;
  if (!isMinutes(bed) || !isMinutes(wake)) return null;
  if (!isFlag(r.screen) || !isFlag(r.caffeine) || !isTime(r.updated_at)) return null;
  return { date: r.date, bed_min: bed, wake_min: wake, screen: r.screen, caffeine: r.caffeine, updated_at: r.updated_at };
}

export function parseSettingsRow(x: unknown): SettingsRow | null {
  if (typeof x !== "object" || x === null) return null;
  const r = x as Record<string, unknown>;
  if (typeof r.target_bed !== "string" || !TIME_RE.test(r.target_bed)) return null;
  if (typeof r.target_wake !== "string" || !TIME_RE.test(r.target_wake)) return null;
  const start = r.start_date ?? null;
  if (start !== null && (typeof start !== "string" || !DATE_RE.test(start))) return null;
  if (typeof r.preset !== "string" || !PRESETS.includes(r.preset)) return null;
  if (typeof r.tasks_json !== "string") return null;
  try {
    const tasks: unknown = JSON.parse(r.tasks_json);
    const ok =
      Array.isArray(tasks) &&
      tasks.length >= 2 &&
      tasks.length <= 3 &&
      new Set(tasks).size === tasks.length &&
      tasks.every((t) => typeof t === "string" && TASKS.includes(t));
    if (!ok) return null;
  } catch {
    return null;
  }
  const pending = r.pending_bed_ts ?? null;
  if (pending !== null && !isTime(pending)) return null;
  if (!isTime(r.updated_at)) return null;
  return {
    target_bed: r.target_bed,
    target_wake: r.target_wake,
    start_date: start,
    tasks_json: r.tasks_json,
    preset: r.preset,
    pending_bed_ts: pending,
    updated_at: r.updated_at,
  };
}

/** 「あとから更新した方」を選ぶ。同時刻なら a(手元)を残す。 */
export function newer<T extends { updated_at: number }>(a: T, b: T): T {
  return b.updated_at > a.updated_at ? b : a;
}

const STOPS = [0.5, 1, 2];

/** 壊れた行は null を返す。 */
export function parseFxOrderRow(x: unknown): FxOrderRow | null {
  if (typeof x !== "object" || x === null) return null;
  const r = x as Record<string, unknown>;
  if (typeof r.date !== "string" || !DATE_RE.test(r.date)) return null;
  if (r.pair !== "USD/JPY") return null;
  if (r.side !== "buy" && r.side !== "sell" && r.side !== "skip") return null;
  if (typeof r.notional !== "number" || !Number.isInteger(r.notional)) return null;
  if (r.side === "skip" ? r.notional !== 0 : r.notional <= 0) return null;
  if (typeof r.entry_rate !== "number" || !Number.isFinite(r.entry_rate) || r.entry_rate <= 0) return null;
  if (typeof r.stop_pct !== "number" || !STOPS.includes(r.stop_pct)) return null;
  if (typeof r.gauge !== "number" || !Number.isInteger(r.gauge) || r.gauge < 0 || r.gauge > 100) return null;
  const reason = r.reason ?? null;
  if (reason !== null && typeof reason !== "string") return null;
  // 古い保存(placed_by がない行)は、自分の注文として読む
  const placedBy = r.placed_by ?? "user";
  if (placedBy !== "user" && placedBy !== "ai") return null;
  const aiComment = r.ai_comment ?? null;
  if (aiComment !== null && (typeof aiComment !== "string" || [...aiComment].length > 200)) return null;
  if (r.side === "skip" && placedBy !== "ai") return null;
  if (!isTime(r.updated_at)) return null;
  return {
    date: r.date,
    pair: r.pair,
    side: r.side,
    notional: r.notional,
    entry_rate: r.entry_rate,
    stop_pct: r.stop_pct,
    gauge: r.gauge,
    reason,
    placed_by: placedBy,
    ai_comment: aiComment,
    updated_at: r.updated_at,
  };
}
