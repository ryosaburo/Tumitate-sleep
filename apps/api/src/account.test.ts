import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bindings } from "./env";
import app from "./index";
import { testEnv } from "./testing/d1";

const T0 = 1_800_000_000_000;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

async function signup(env: Bindings) {
  const r = (await (await app.request("/v1/accounts", { method: "POST" }, env)).json()) as { accountId: string; token: string };
  return { accountId: r.accountId, headers: { Authorization: `Bearer ${r.accountId}.${r.token}`, "Content-Type": "application/json" } };
}
const del = (env: Bindings, headers: Record<string, string>) => app.request("/v1/account", { method: "DELETE", headers }, env);
const sync = (env: Bindings, headers: Record<string, string>, body: unknown) => app.request("/v1/sync", { method: "POST", headers, body: JSON.stringify(body) }, env);
const count = async (env: Bindings, table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n;

const everything = {
  since: 0,
  changes: {
    records: [{ date: "2026-10-11", bed_min: 210, wake_min: 630, screen: 1, caffeine: 0, updated_at: T0 - 1 }],
    settings: { target_bed: "23:30", target_wake: "06:30", start_date: null, tasks_json: '["bed","screen"]', preset: "bal", pending_bed_ts: null, updated_at: T0 - 1 },
    fx_trades: [{ id: "t1", date: "2026-10-12", pair: "USD/JPY", side: "buy", notional: 2000, entry_rate: 150, stop_rate: 149, exit_rate: null, exit_reason: null, pnl: null, gauge: 80, reason: null, settled_at: null, updated_at: T0 - 1 }],
    fx_ledger: [{ id: "g1", date: "2026-10-12", kind: "grant", amount: 10000, updated_at: T0 - 1 }],
  },
};

describe("DELETE /v1/account", () => {
  it("アカウントと全データを消す。以後、同じトークンは使えない", async () => {
    const env = testEnv();
    const a = await signup(env);
    await sync(env, a.headers, everything);
    await app.request("/v1/link/start", { method: "POST", headers: a.headers }, env);

    const res = await del(env, a.headers);
    expect(res.status).toBe(204);
    for (const t of ["accounts", "records", "settings", "fx_trades", "fx_ledger", "link_codes", "account_tokens"]) {
      expect(await count(env, t)).toBe(0);
    }
    expect((await sync(env, a.headers, { since: 0 })).status).toBe(401);
    expect((await del(env, a.headers)).status).toBe(401);
  });

  it("引き継ぎで増やしたトークンも、すべて使えなくなる。未使用のコードも使えない", async () => {
    const env = testEnv();
    const a = await signup(env);
    const { code } = (await (await app.request("/v1/link/start", { method: "POST", headers: a.headers }, env)).json()) as { code: string };
    const second = (await (await app.request("/v1/link/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }, env)).json()) as { accountId: string; token: string };
    const h2 = { Authorization: `Bearer ${second.accountId}.${second.token}`, "Content-Type": "application/json" };
    const { code: pending } = (await (await app.request("/v1/link/start", { method: "POST", headers: a.headers }, env)).json()) as { code: string };

    expect((await del(env, h2)).status).toBe(204); // 2 台目から消してもよい
    expect((await sync(env, a.headers, { since: 0 })).status).toBe(401);
    expect((await sync(env, h2, { since: 0 })).status).toBe(401);
    const r = await app.request("/v1/link/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: pending }) }, env);
    expect(r.status).toBe(400);
  });

  it("ほかのアカウントのデータは消さない", async () => {
    const env = testEnv();
    const a = await signup(env);
    const b = await signup(env);
    await sync(env, a.headers, everything);
    await sync(env, b.headers, everything);
    await del(env, a.headers);
    const got = (await (await sync(env, b.headers, { since: 0 })).json()) as { changes: { records: unknown[]; settings: unknown; fx_trades: unknown[]; fx_ledger: unknown[] } };
    expect(got.changes.records).toHaveLength(1);
    expect(got.changes.settings).not.toBeNull();
    expect(got.changes.fx_trades).toHaveLength(1);
    expect(got.changes.fx_ledger).toHaveLength(1);
  });

  it("認証がないと 401。何も消えない", async () => {
    const env = testEnv();
    await signup(env);
    expect((await del(env, {})).status).toBe(401);
    expect(await count(env, "accounts")).toBe(1);
  });
});
