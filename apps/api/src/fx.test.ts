import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "./index";
import { createTestAi, testEnv } from "./testing/d1";
import type { Bindings } from "./env";
import { AI_DAILY_LIMIT, AI_PERSONA } from "@nekase/core";

async function signup(env: Bindings) {
  const r = (await (await app.request("/v1/accounts", { method: "POST" }, env)).json()) as { accountId: string; token: string };
  return { Authorization: `Bearer ${r.accountId}.${r.token}`, "Content-Type": "application/json" };
}
const ask = (env: Bindings, headers: Record<string, string>, body: unknown = { rates: [150, 150.4, 149.9], gauge: 10, limit: 4000 }) =>
  app.request("/v1/fx/ai-order", { method: "POST", headers, body: JSON.stringify(body) }, env);
const ok = (decision: unknown) => () => ({ response: decision });

let err: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  err.mockRestore();
  vi.useRealTimers();
});

describe("POST /v1/fx/ai-order", () => {
  it("認証が必要", async () => {
    const env = testEnv();
    const r = await app.request("/v1/fx/ai-order", { method: "POST", body: "{}" }, env);
    expect(r.status).toBe(401);
  });

  it("AI の返答を、範囲に収めて返す", async () => {
    const t = createTestAi(ok({ side: "buy", amount: 99999, stopPct: 5, comment: "飛びつきました" }));
    const env = testEnv(t.ai);
    const r = await ask(env, await signup(env));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ decision: { side: "buy", amount: 4000, stopPct: 2, comment: "飛びつきました" } });
  });

  it("ゲージに応じた指示を、AI に渡す。睡眠の時刻や ID は渡さない", async () => {
    const t = createTestAi(ok({ side: "skip", comment: "" }));
    const env = testEnv(t.ai);
    const h = await signup(env);
    await ask(env, h, { rates: [150, 151], gauge: 10, limit: 2000 });
    await ask(env, h, { rates: [150, 151], gauge: 90, limit: 2000 });
    const sys = (i: number) => (t.calls[i]!.input as { messages: { content: string }[] }).messages[0]!.content;
    expect(sys(0)).toContain(AI_PERSONA.low.instruction);
    expect(sys(1)).toContain(AI_PERSONA.high.instruction);
    const all = JSON.stringify(t.calls);
    expect(all).not.toMatch(/accountId|Bearer|"token"/);
    expect(t.calls[0]!.model).toBe("@cf/meta/llama-3.1-8b-instruct");
  });

  it("モデルは環境変数で入れ替えられる", async () => {
    const t = createTestAi(ok({ side: "skip", comment: "" }));
    const env = { ...testEnv(t.ai), AI_MODEL: "@cf/test/model" };
    await ask(env, await signup(env));
    expect(t.calls[0]!.model).toBe("@cf/test/model");
  });

  it("文字列の JSON でも読める", async () => {
    const env = testEnv(createTestAi(() => ({ response: '{"side":"sell","amount":1000,"stopPct":1,"comment":"x"}' })).ai);
    const r = await ask(env, await signup(env));
    expect(((await r.json()) as { decision: { side: string } }).decision.side).toBe("sell");
  });

  it("入力の検証: 不要な項目は無視し、範囲外は 400", async () => {
    const t = createTestAi(ok({ side: "skip", comment: "" }));
    const env = testEnv(t.ai);
    const h = await signup(env);
    for (const bad of [{ rates: [], gauge: 10, limit: 0 }, { rates: [150], gauge: 101, limit: 0 }, { rates: [150], gauge: 10, limit: 1500 }, { rates: [1], gauge: 10, limit: 0 }, { rates: Array(8).fill(150), gauge: 10, limit: 0 }]) {
      expect((await ask(env, h, bad)).status).toBe(400);
    }
    expect((await app.request("/v1/fx/ai-order", { method: "POST", headers: h, body: "not json" }, env)).status).toBe(400);
    expect(t.calls).toHaveLength(0);
    // 睡眠の時刻などの余計な項目は、AI の入力に入らない
    await ask(env, h, { rates: [150], gauge: 10, limit: 0, bedTime: "23:30", accountId: "x" });
    expect(JSON.stringify(t.calls)).not.toMatch(/23:30|bedTime/);
  });

  it(`1 日 ${AI_DAILY_LIMIT} 回まで(失敗も数える)。超えたら 429 で AI を呼ばない`, async () => {
    const t = createTestAi(() => {
      throw new Error("down");
    });
    const env = testEnv(t.ai);
    const h = await signup(env);
    for (let i = 0; i < AI_DAILY_LIMIT; i++) expect((await ask(env, h)).status).toBe(502);
    const r = await ask(env, h);
    expect(r.status).toBe(429);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe("ai_limit");
    expect(t.calls).toHaveLength(AI_DAILY_LIMIT);
  });

  it("回数はアカウントごと", async () => {
    const t = createTestAi(ok({ side: "skip", comment: "" }));
    const env = testEnv(t.ai);
    const a = await signup(env);
    const b = await signup(env);
    for (let i = 0; i < AI_DAILY_LIMIT; i++) await ask(env, a);
    expect((await ask(env, a)).status).toBe(429);
    expect((await ask(env, b)).status).toBe(200);
  });

  it("日が変われば(日本時間)、また呼べる", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T14:00:00Z")); // 日本時間 10/15 23:00
    const env = testEnv(createTestAi(ok({ side: "skip", comment: "" })).ai);
    const h = await signup(env);
    for (let i = 0; i < AI_DAILY_LIMIT; i++) await ask(env, h);
    expect((await ask(env, h)).status).toBe(429);
    vi.setSystemTime(new Date("2026-10-15T15:01:00Z")); // 日本時間 10/16 00:01
    expect((await ask(env, h)).status).toBe(200);
  });

  it("AI の失敗・不正な返答は、注文を作らずにエラーを返す", async () => {
    for (const reply of [() => { throw new Error("down"); }, ok({ side: "hold" }), ok(null), () => ({ response: "not json" })]) {
      const env = testEnv(createTestAi(reply).ai);
      const r = await ask(env, await signup(env));
      expect([502, 504]).toContain(r.status);
      expect(((await r.json()) as { error: { message: string } }).error.message).toContain("自分で注文できます");
    }
  });

  it("10 秒で打ち切る(504)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const t = createTestAi(() => new Promise(() => {}));
    const env = testEnv(t.ai);
    const h = await signup(env);
    const p = ask(env, h);
    // AI が呼ばれて(= 打ち切りのタイマーが置かれて)から、時計を進める
    for (let i = 0; i < 100 && t.calls.length === 0; i++) await new Promise((r) => setImmediate(r));
    await vi.advanceTimersByTimeAsync(10_001);
    const r = await p;
    expect(r.status).toBe(504);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe("ai_timeout");
  });
});
