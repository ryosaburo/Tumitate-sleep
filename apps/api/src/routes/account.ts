import { Hono } from "hono";
import { requireAuth } from "../auth";
import type { AppEnv } from "../env";

export const account = new Hono<AppEnv>();
account.use(requireAuth);

/** アカウントに属する表。accounts は最後に消す(新しい表を足したら、ここにも足す)。 */
const OWNED_TABLES = ["records", "settings", "fx_trades", "fx_ledger", "link_codes", "account_tokens"] as const;

/** DELETE /v1/account: アカウントと全データを削除する。元に戻せない。全部消えるか、何も消えないかのどちらか。 */
account.delete("/", async (c) => {
  const id = c.get("accountId");
  const db = c.env.DB;
  await db.batch([
    ...OWNED_TABLES.map((t) => db.prepare(`DELETE FROM ${t} WHERE account_id = ?`).bind(id)),
    db.prepare("DELETE FROM accounts WHERE id = ?").bind(id),
  ]);
  return c.body(null, 204);
});
