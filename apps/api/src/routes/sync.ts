import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";

export const sync = new Hono<AppEnv>();
sync.use(requireAuth);

const MAX_ROWS = 500;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const ms = z.number().int().min(0);
const minutes = z.number().int().min(0).max(1440).nullable();
const flag = z.union([z.literal(0), z.literal(1)]);
const label = z.string().min(1).max(64);

const RecordRow = z.object({
  date,
  bed_min: minutes,
  wake_min: minutes,
  screen: flag,
  caffeine: flag,
  updated_at: ms,
});

const TASKS = ["bed", "wake", "screen", "caffeine"];
const SettingsRow = z.object({
  target_bed: time,
  target_wake: time,
  start_date: date.nullable(),
  tasks_json: z.string().max(200).refine((s) => {
    try {
      const v: unknown = JSON.parse(s);
      return Array.isArray(v) && v.length >= 2 && v.length <= 3 && new Set(v).size === v.length && v.every((t) => TASKS.includes(t as string));
    } catch {
      return false;
    }
  }, "tasks_json は、4 つの課題から 2〜3 個の JSON 配列にしてください"),
  preset: z.enum(["safe", "bal", "grow"]),
  pending_bed_ts: ms.nullable(),
  updated_at: ms,
});

const FxTradeRow = z.object({
  id: label,
  date,
  pair: label,
  side: label,
  notional: z.number().int().min(0),
  entry_rate: z.number().finite(),
  stop_rate: z.number().finite(),
  exit_rate: z.number().finite().nullable(),
  exit_reason: label.nullable(),
  pnl: z.number().int().nullable(),
  gauge: z.number().int().min(0).max(100).nullable(),
  reason: z.string().max(200).nullable(),
  settled_at: ms.nullable(),
  updated_at: ms,
});

const FxLedgerRow = z.object({
  id: label,
  date,
  kind: z.enum(["grant", "pnl"]),
  amount: z.number().int(),
  updated_at: ms,
});

const Body = z.object({
  /** 前回の同期でもらった serverTime。初回は 0 */
  since: ms,
  changes: z
    .object({
      records: z.array(RecordRow).max(MAX_ROWS).default([]),
      settings: SettingsRow.nullable().default(null),
      fx_trades: z.array(FxTradeRow).max(MAX_ROWS).default([]),
      fx_ledger: z.array(FxLedgerRow).max(MAX_ROWS).default([]),
    })
    .default({ records: [], settings: null, fx_trades: [], fx_ledger: [] }),
});

type Cols = readonly string[];

/**
 * 1 行を書く SQL。同じ主キーがあれば、送られた updated_at が保存済みより新しいときだけ上書きする(あとから更新した方が勝つ)。
 * 同時刻なら、保存済みを残す。上書きしたときだけ synced_at を進める。
 */
function upsertSql(table: string, keys: Cols, cols: Cols): string {
  const all = ["account_id", ...keys, ...cols, "updated_at", "synced_at"];
  const marks = all.map(() => "?").join(", ");
  const sets = [...cols, "updated_at", "synced_at"].map((c) => `${c} = excluded.${c}`).join(", ");
  return `INSERT INTO ${table} (${all.join(", ")}) VALUES (${marks})
    ON CONFLICT (${["account_id", ...keys].join(", ")}) DO UPDATE SET ${sets}
    WHERE excluded.updated_at > ${table}.updated_at`;
}

const TABLES = {
  records: { keys: ["date"], cols: ["bed_min", "wake_min", "screen", "caffeine"] },
  settings: { keys: [], cols: ["target_bed", "target_wake", "start_date", "tasks_json", "preset", "pending_bed_ts"] },
  fx_trades: {
    keys: ["id"],
    cols: ["date", "pair", "side", "notional", "entry_rate", "stop_rate", "exit_rate", "exit_reason", "pnl", "gauge", "reason", "settled_at"],
  },
  fx_ledger: { keys: ["id"], cols: ["date", "kind", "amount"] },
} as const;

const SQL = Object.fromEntries(Object.entries(TABLES).map(([t, d]) => [t, upsertSql(t, d.keys, d.cols)])) as Record<keyof typeof TABLES, string>;

/** POST /v1/sync: 端末の変更を受け取り、前回の同期より後に届いた変更を返す。 */
sync.post("/", async (c) => {
  const parsed = Body.safeParse(await c.req.json().catch(() => {
    throw new ApiError(400, "invalid_json", "本文が JSON ではありません。");
  }));
  if (!parsed.success) throw parsed.error;
  const { since, changes } = parsed.data;
  const accountId = c.get("accountId");
  const db = c.env.DB;
  const serverTime = Date.now();

  // 端末の時計が進んでいても、未来の値が勝ち続けないよう、サーバー時刻を上限にそろえる
  const bind = (table: keyof typeof TABLES, row: Record<string, unknown>) => {
    const d = TABLES[table];
    const values = [accountId, ...d.keys.map((k) => row[k]), ...d.cols.map((k) => row[k]), Math.min(row.updated_at as number, serverTime), serverTime];
    return db.prepare(SQL[table]).bind(...values);
  };
  const stmts = [
    ...changes.records.map((r) => bind("records", r)),
    ...(changes.settings ? [bind("settings", changes.settings)] : []),
    ...changes.fx_trades.map((r) => bind("fx_trades", r)),
    ...changes.fx_ledger.map((r) => bind("fx_ledger", r)),
  ];
  if (stmts.length > 0) await db.batch(stmts);

  // synced_at が since 以上のものを返す(同じミリ秒に届いた分を取りこぼさないため、>= で返す。重複しても害はない)
  const select = async <T>(table: string, cols: Cols, order: string) =>
    (await db.prepare(`SELECT ${cols.join(", ")} FROM ${table} WHERE account_id = ? AND synced_at >= ? ORDER BY ${order}`).bind(accountId, since).all<T>()).results;

  const [records, settings, fxTrades, fxLedger] = await Promise.all([
    select("records", ["date", ...TABLES.records.cols, "updated_at"], "date"),
    select("settings", [...TABLES.settings.cols, "updated_at"], "updated_at"),
    select("fx_trades", ["id", ...TABLES.fx_trades.cols, "updated_at"], "id"),
    select("fx_ledger", ["id", ...TABLES.fx_ledger.cols, "updated_at"], "id"),
  ]);

  return c.json({
    serverTime,
    changes: { records, settings: settings[0] ?? null, fx_trades: fxTrades, fx_ledger: fxLedger },
  });
});
