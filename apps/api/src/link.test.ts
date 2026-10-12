import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bindings } from "./env";
import app from "./index";
import { testEnv } from "./testing/d1";

const T0 = 1_800_000_000_000;
const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

async function signup(env: Bindings) {
  const r = (await (await app.request("/v1/accounts", { method: "POST" }, env)).json()) as { accountId: string; token: string };
  return { accountId: r.accountId, headers: { Authorization: `Bearer ${r.accountId}.${r.token}`, "Content-Type": "application/json" } };
}
const start = (env: Bindings, headers: Record<string, string>) => app.request("/v1/link/start", { method: "POST", headers }, env);
const redeem = (env: Bindings, code: string, ip = "1.1.1.1") =>
  app.request("/v1/link/redeem", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip }, body: JSON.stringify({ code }) }, env);
const issue = async (env: Bindings, headers: Record<string, string>) => ((await (await start(env, headers)).json()) as { code: string; expiresAt: number }).code;
const errCode = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe("POST /v1/link/start", () => {
  it("8 文字のコードと有効期限(10 分)を返す。紛らわしい文字は使わない", async () => {
    const env = testEnv();
    const { headers } = await signup(env);
    for (let i = 0; i < 20; i++) {
      const res = await start(env, headers);
      expect(res.status).toBe(201);
      const body = (await res.json()) as { code: string; expiresAt: number };
      expect(body.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/);
      expect(body.expiresAt).toBe(T0 + 10 * MIN);
    }
  });

  it("認証がないと 401", async () => {
    const res = await start(testEnv(), {});
    expect(res.status).toBe(401);
  });

  it("コードそのものは保存しない(ハッシュだけ)", async () => {
    const env = testEnv();
    const { headers } = await signup(env);
    const code = await issue(env, headers);
    const rows = (await env.DB.prepare("SELECT code_hash FROM link_codes").all<{ code_hash: string }>()).results;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.code_hash).not.toContain(code);
  });

  it("出し直すと、前の未使用のコードは無効になる", async () => {
    const env = testEnv();
    const { headers } = await signup(env);
    const old = await issue(env, headers);
    const fresh = await issue(env, headers);
    expect(await errCode(await redeem(env, old))).toBe("invalid_code");
    expect((await redeem(env, fresh)).status).toBe(200);
  });
});

describe("POST /v1/link/redeem: 正常系", () => {
  it("2 台目が同じアカウントの新しいトークンを受け取り、同じ記録を同期できる。1 台目のトークンも使える", async () => {
    const env = testEnv();
    const first = await signup(env);
    // 1 台目が記録を送る
    await app.request("/v1/sync", { method: "POST", headers: first.headers, body: JSON.stringify({ since: 0, changes: { records: [{ date: "2026-10-11", bed_min: 210, wake_min: 630, screen: 1, caffeine: 0, updated_at: T0 - 1000 }] } }) }, env);

    const code = await issue(env, first.headers);
    const res = await redeem(env, code);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accountId: string; token: string };
    expect(body.accountId).toBe(first.accountId);

    const second = { Authorization: `Bearer ${body.accountId}.${body.token}`, "Content-Type": "application/json" };
    for (const h of [second, first.headers]) {
      const got = (await (await app.request("/v1/sync", { method: "POST", headers: h, body: JSON.stringify({ since: 0 }) }, env)).json()) as { changes: { records: { date: string }[] } };
      expect(got.changes.records.map((r) => r.date)).toEqual(["2026-10-11"]);
    }
  });

  it("小文字・空白・ハイフンが混ざっていても受け付ける", async () => {
    const env = testEnv();
    const { headers } = await signup(env);
    const code = await issue(env, headers);
    const typed = ` ${code.slice(0, 4).toLowerCase()}-${code.slice(4)} `;
    expect((await redeem(env, typed)).status).toBe(200);
  });

  it("有効期限の 1 ミリ秒前までは使える", async () => {
    const env = testEnv();
    const { headers } = await signup(env);
    const code = await issue(env, headers);
    vi.setSystemTime(T0 + 10 * MIN - 1);
    expect((await redeem(env, code)).status).toBe(200);
  });
});

describe("POST /v1/link/redeem: コードのエラー", () => {
  it("有効期限(ちょうど 10 分)を過ぎると code_expired", async () => {
    const env = testEnv();
    const { headers } = await signup(env);
    const code = await issue(env, headers);
    vi.setSystemTime(T0 + 10 * MIN);
    const res = await redeem(env, code);
    expect(res.status).toBe(400);
    expect(await errCode(res)).toBe("code_expired");
  });

  it("1 回使ったコードは、もう一度は使えない(code_used)", async () => {
    const env = testEnv();
    const { headers } = await signup(env);
    const code = await issue(env, headers);
    expect((await redeem(env, code)).status).toBe(200);
    const again = await redeem(env, code);
    expect(again.status).toBe(400);
    expect(await errCode(again)).toBe("code_used");
    // トークンも、1 つしか増えていない
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM account_tokens").first<{ n: number }>();
    expect(n!.n).toBe(1);
  });

  it("存在しないコードは invalid_code。本文が不正なら 400", async () => {
    const env = testEnv();
    expect(await errCode(await redeem(env, "ABCD2345"))).toBe("invalid_code");
    const res = await app.request("/v1/link/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }, env);
    expect(res.status).toBe(400);
    expect(await errCode(res)).toBe("invalid_request");
  });
});

describe("POST /v1/link/redeem: 試行回数の制限", () => {
  it("同じ送信元は、10 分に 5 回まで。6 回目は、正しいコードでも 429", async () => {
    const env = testEnv();
    const { headers } = await signup(env);
    const code = await issue(env, headers);
    for (let i = 0; i < 5; i++) expect((await redeem(env, "ZZZZZZZZ")).status).toBe(400);
    const blocked = await redeem(env, code);
    expect(blocked.status).toBe(429);
    expect(await errCode(blocked)).toBe("too_many_attempts");
    expect(blocked.headers.get("Retry-After")).toBe("600");
  });

  it("別の送信元には影響しない", async () => {
    const env = testEnv();
    const { headers } = await signup(env);
    const code = await issue(env, headers);
    for (let i = 0; i < 5; i++) await redeem(env, "ZZZZZZZZ", "9.9.9.9");
    expect((await redeem(env, "ZZZZZZZZ", "9.9.9.9")).status).toBe(429);
    expect((await redeem(env, code, "2.2.2.2")).status).toBe(200);
  });

  it("10 分たつと、また試せる", async () => {
    const env = testEnv();
    const { headers } = await signup(env);
    for (let i = 0; i < 5; i++) await redeem(env, "ZZZZZZZZ");
    expect((await redeem(env, "ZZZZZZZZ")).status).toBe(429);
    vi.setSystemTime(T0 + 10 * MIN + 1);
    const code = await issue(env, headers);
    expect((await redeem(env, code)).status).toBe(200);
  });

  it("成功した試行も、回数に数える", async () => {
    const env = testEnv();
    const { headers } = await signup(env);
    for (let i = 0; i < 5; i++) expect((await redeem(env, await issue(env, headers))).status).toBe(200);
    expect((await redeem(env, await issue(env, headers))).status).toBe(429);
  });
});
