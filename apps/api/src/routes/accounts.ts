import { Hono } from "hono";
import { randomToken, sha256Hex } from "../crypto";
import type { AppEnv } from "../env";

export const accounts = new Hono<AppEnv>();

/** POST /v1/accounts: 匿名のアカウントを作る。トークンはここで 1 回だけ返し、サーバーにはハッシュだけを置く。 */
accounts.post("/", async (c) => {
  const accountId = crypto.randomUUID();
  const token = randomToken();
  await c.env.DB.prepare("INSERT INTO accounts (id, token_hash, created_at) VALUES (?, ?, ?)")
    .bind(accountId, await sha256Hex(token), Date.now())
    .run();
  return c.json({ accountId, token }, 201);
});
