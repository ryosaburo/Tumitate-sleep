import { createMiddleware } from "hono/factory";
import { sha256Hex, safeEqual } from "./crypto";
import type { AppEnv } from "./env";
import { ApiError } from "./errors";

/** `Authorization: Bearer <accountId>.<token>` を確かめる。アカウント ID は UUID(ドットを含まない)。 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const m = /^Bearer ([0-9a-f-]{36})\.([A-Za-z0-9_-]{20,})$/.exec(c.req.header("Authorization") ?? "");
  if (!m) throw new ApiError(401, "unauthorized", "認証が必要です。");
  const [, accountId, token] = m as unknown as [string, string, string];
  const hash = await sha256Hex(token);
  // 最初のトークン(accounts)と、引き継ぎで足したトークン(account_tokens)のどちらかに合えばよい
  const first = await c.env.DB.prepare("SELECT token_hash FROM accounts WHERE id = ?").bind(accountId).first<{ token_hash: string }>();
  let ok = first !== null && safeEqual(first.token_hash, hash);
  if (first !== null && !ok) {
    const extra = await c.env.DB.prepare("SELECT token_hash FROM account_tokens WHERE account_id = ?").bind(accountId).all<{ token_hash: string }>();
    ok = extra.results.some((t) => safeEqual(t.token_hash, hash));
  }
  if (!ok) throw new ApiError(401, "unauthorized", "認証に失敗しました。");
  c.set("accountId", accountId);
  await next();
});
