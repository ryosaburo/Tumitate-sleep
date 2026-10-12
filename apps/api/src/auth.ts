import { createMiddleware } from "hono/factory";
import { sha256Hex, safeEqual } from "./crypto";
import type { AppEnv } from "./env";
import { ApiError } from "./errors";

/** `Authorization: Bearer <accountId>.<token>` を確かめる。アカウント ID は UUID(ドットを含まない)。 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const m = /^Bearer ([0-9a-f-]{36})\.([A-Za-z0-9_-]{20,})$/.exec(c.req.header("Authorization") ?? "");
  if (!m) throw new ApiError(401, "unauthorized", "認証が必要です。");
  const [, accountId, token] = m as unknown as [string, string, string];
  const row = await c.env.DB.prepare("SELECT token_hash FROM accounts WHERE id = ?").bind(accountId).first<{ token_hash: string }>();
  const ok = row !== null && safeEqual(row.token_hash, await sha256Hex(token));
  if (!ok) throw new ApiError(401, "unauthorized", "認証に失敗しました。");
  c.set("accountId", accountId);
  await next();
});
