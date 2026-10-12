import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth";
import { randomToken, sha256Hex } from "../crypto";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";

export const link = new Hono<AppEnv>();

/** 紛らわしい文字(0 と O、1 と I と L)を除いた 31 文字。8 文字で約 8.5 兆通り。 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
export const CODE_TTL_MS = 10 * 60 * 1000;
/** コードの試行は、同じ送信元から 10 分に 5 回まで */
export const REDEEM_LIMIT = 5;
export const REDEEM_WINDOW_MS = 10 * 60 * 1000;

/** 偏りのないランダムなコード(256 を 31 で割った余りの範囲は捨てる) */
function newCode(): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < limit && out.length < CODE_LENGTH) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

/** 入力されたコードを整える(大文字にし、空白とハイフンを除く) */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

/** POST /v1/link/start: 引き継ぎコードを発行する(1 台目で使う)。前に出した未使用のコードは無効にする。 */
link.post("/start", requireAuth, async (c) => {
  const accountId = c.get("accountId");
  const now = Date.now();
  await c.env.DB.prepare("DELETE FROM link_codes WHERE account_id = ? AND used_at IS NULL").bind(accountId).run();
  const code = newCode();
  const expiresAt = now + CODE_TTL_MS;
  await c.env.DB.prepare("INSERT INTO link_codes (code_hash, account_id, expires_at, used_at) VALUES (?, ?, ?, NULL)")
    .bind(await sha256Hex(code), accountId, expiresAt)
    .run();
  return c.json({ code, expiresAt }, 201);
});

const RedeemBody = z.object({ code: z.string().min(1).max(32) });

/** POST /v1/link/redeem: コードを渡して、同じアカウントの新しいトークンを受け取る(2 台目で使う)。 */
link.post("/redeem", async (c) => {
  const { code: raw } = RedeemBody.parse(
    await c.req.json().catch(() => {
      throw new ApiError(400, "invalid_json", "本文が JSON ではありません。");
    }),
  );
  const db = c.env.DB;
  const now = Date.now();

  // 試行回数の制限(成功も失敗も数える)。送信元ごとに、窓の中で REDEEM_LIMIT 回まで。
  const key = `redeem:${c.req.header("CF-Connecting-IP") ?? "unknown"}`;
  await db.prepare("DELETE FROM rate_limits WHERE at <= ?").bind(now - REDEEM_WINDOW_MS).run();
  const used = await db.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE key = ? AND at > ?").bind(key, now - REDEEM_WINDOW_MS).first<{ n: number }>();
  if ((used?.n ?? 0) >= REDEEM_LIMIT) {
    c.header("Retry-After", String(Math.ceil(REDEEM_WINDOW_MS / 1000)));
    throw new ApiError(429, "too_many_attempts", "試行回数が多すぎます。しばらくたってからやり直してください。");
  }
  await db.prepare("INSERT INTO rate_limits (key, at) VALUES (?, ?)").bind(key, now).run();

  const hash = await sha256Hex(normalizeCode(raw));
  const row = await db.prepare("SELECT account_id, expires_at, used_at FROM link_codes WHERE code_hash = ?").bind(hash).first<{ account_id: string; expires_at: number; used_at: number | null }>();
  if (!row) throw new ApiError(400, "invalid_code", "コードが違います。");
  if (row.used_at !== null) throw new ApiError(400, "code_used", "このコードは、すでに使われました。");
  if (row.expires_at <= now) throw new ApiError(400, "code_expired", "コードの有効期限が切れました。もう一度、発行してください。");

  // 同時に 2 回使われても、1 回だけ成功するよう、未使用の条件つきで更新する
  const claimed = await db.prepare("UPDATE link_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?").bind(now, hash, now).run();
  if (claimed.meta.changes !== 1) throw new ApiError(400, "code_used", "このコードは、すでに使われました。");

  const token = randomToken();
  await db.prepare("INSERT INTO account_tokens (token_hash, account_id, created_at) VALUES (?, ?, ?)").bind(await sha256Hex(token), row.account_id, now).run();
  return c.json({ accountId: row.account_id, token });
});
