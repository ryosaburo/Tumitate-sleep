import { describe, expect, it } from "vitest";
import app from "./index";
import { testEnv } from "./testing/d1";

describe("POST /v1/accounts", () => {
  it("アカウントを作り、トークンのハッシュだけを保存する", async () => {
    const env = testEnv();
    const res = await app.request("/v1/accounts", { method: "POST" }, env);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { accountId: string; token: string };
    expect(body.accountId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.token.length).toBeGreaterThanOrEqual(40);

    const row = await env.DB.prepare("SELECT token_hash, created_at FROM accounts WHERE id = ?").bind(body.accountId).first<{ token_hash: string }>();
    expect(row).not.toBeNull();
    expect(row!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.token_hash).not.toContain(body.token);
  });

  it("作るたびに別の ID とトークンになる", async () => {
    const env = testEnv();
    const a = (await (await app.request("/v1/accounts", { method: "POST" }, env)).json()) as { accountId: string; token: string };
    const b = (await (await app.request("/v1/accounts", { method: "POST" }, env)).json()) as { accountId: string; token: string };
    expect(a.accountId).not.toBe(b.accountId);
    expect(a.token).not.toBe(b.token);
  });
});

describe("共通のエラー形式", () => {
  it("存在しないパスは、統一した形の 404", async () => {
    const res = await app.request("/v1/nothing", {}, testEnv());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "見つかりません。" } });
  });
});
