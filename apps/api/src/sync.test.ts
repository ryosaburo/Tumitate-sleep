import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "./index";
import { testEnv } from "./testing/d1";
import type { Bindings } from "./env";

const T0 = 1_800_000_000_000;

async function signup(env: Bindings) {
  const r = (await (await app.request("/v1/accounts", { method: "POST" }, env)).json()) as { accountId: string; token: string };
  return { Authorization: `Bearer ${r.accountId}.${r.token}`, "Content-Type": "application/json" };
}

const post = (env: Bindings, headers: Record<string, string>, body: unknown) =>
  app.request("/v1/sync", { method: "POST", headers, body: JSON.stringify(body) }, env);

interface SyncResult {
  serverTime: number;
  changes: {
    records: { date: string; bed_min: number | null; screen: number; updated_at: number }[];
    settings: { preset: string; pending_bed_ts: number | null; updated_at: number } | null;
    fx_trades: { id: string }[];
    fx_ledger: { id: string; amount: number }[];
  };
}

const rec = (date: string, over: Record<string, unknown> = {}) => ({ date, bed_min: 210, wake_min: 630, screen: 1, caffeine: 0, updated_at: T0 - 1000, ...over });
const settings = (over: Record<string, unknown> = {}) => ({
  target_bed: "23:30",
  target_wake: "06:30",
  start_date: "2026-10-01",
  tasks_json: '["bed","screen","caffeine"]',
  preset: "bal",
  pending_bed_ts: null,
  updated_at: T0 - 1000,
  ...over,
});
const trade = (id: string, over: Record<string, unknown> = {}) => ({
  id, date: "2026-10-12", pair: "USD/JPY", side: "buy", notional: 2000, entry_rate: 150.1, stop_rate: 149.35,
  exit_rate: null, exit_reason: null, pnl: null, gauge: 80, reason: null, settled_at: null, updated_at: T0 - 1000, ...over,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

describe("POST /v1/sync: 正常系", () => {
  it("送った変更を保存し、次の同期で(別の端末でも)取得できる", async () => {
    const env = testEnv();
    const auth = await signup(env);
    const res = await post(env, auth, {
      since: 0,
      changes: {
        records: [rec("2026-10-11"), rec("2026-10-12", { bed_min: null, wake_min: null })],
        settings: settings({ pending_bed_ts: T0 - 5000 }),
        fx_trades: [trade("t1")],
        fx_ledger: [{ id: "g1", date: "2026-10-12", kind: "grant", amount: 10000, updated_at: T0 - 1000 }],
      },
    });
    expect(res.status).toBe(200);
    const first = (await res.json()) as SyncResult;
    expect(first.serverTime).toBe(T0);

    // 2 台目: 何も送らず、since=0 で全部もらう
    const got = (await (await post(env, auth, { since: 0 })).json()) as SyncResult;
    expect(got.changes.records.map((r) => r.date)).toEqual(["2026-10-11", "2026-10-12"]);
    expect(got.changes.records[1]!.bed_min).toBeNull();
    expect(got.changes.settings).toMatchObject({ preset: "bal", pending_bed_ts: T0 - 5000 });
    expect(got.changes.fx_trades.map((t) => t.id)).toEqual(["t1"]);
    expect(got.changes.fx_ledger).toEqual([expect.objectContaining({ id: "g1", amount: 10000 })]);
  });

  it("since より前に届いた変更は返さない", async () => {
    const env = testEnv();
    const auth = await signup(env);
    await post(env, auth, { since: 0, changes: { records: [rec("2026-10-11")] } });
    vi.setSystemTime(T0 + 60_000);
    await post(env, auth, { since: 0, changes: { records: [rec("2026-10-12")] } });
    const got = (await (await post(env, auth, { since: T0 + 1 })).json()) as SyncResult;
    expect(got.changes.records.map((r) => r.date)).toEqual(["2026-10-12"]);
  });

  it("圏外で編集した古い updated_at の行も、あとで同期すれば他の端末が受け取れる", async () => {
    const env = testEnv();
    const auth = await signup(env);
    // 端末 B は T0 に同期して serverTime=T0 を持っている
    const b = (await (await post(env, auth, { since: 0 })).json()) as SyncResult;
    // 端末 A が、圏外で T0-100000 に編集した行を、T0+60秒に初めて同期する
    vi.setSystemTime(T0 + 60_000);
    await post(env, auth, { since: 0, changes: { records: [rec("2026-10-10", { updated_at: T0 - 100_000 })] } });
    const got = (await (await post(env, auth, { since: b.serverTime })).json()) as SyncResult;
    expect(got.changes.records.map((r) => r.date)).toEqual(["2026-10-10"]);
  });

  it("changes を省いても同期できる", async () => {
    const env = testEnv();
    const res = await post(env, await signup(env), { since: 0 });
    expect(res.status).toBe(200);
    expect(((await res.json()) as SyncResult).changes).toEqual({ records: [], settings: null, fx_trades: [], fx_ledger: [] });
  });

  it("アカウントごとに、データは分かれている", async () => {
    const env = testEnv();
    const a = await signup(env);
    const b = await signup(env);
    await post(env, a, { since: 0, changes: { records: [rec("2026-10-11")], settings: settings() } });
    const got = (await (await post(env, b, { since: 0 })).json()) as SyncResult;
    expect(got.changes.records).toEqual([]);
    expect(got.changes.settings).toBeNull();
  });
});

describe("POST /v1/sync: 認証エラー", () => {
  it("ヘッダーなし・形式違い・トークン違い・存在しない ID は 401", async () => {
    const env = testEnv();
    const auth = await signup(env);
    const id = auth.Authorization.split(" ")[1]!.split(".")[0]!;
    const headers: Record<string, string>[] = [
      {},
      { Authorization: "Basic abc" },
      { Authorization: `Bearer ${id}.${"x".repeat(43)}` },
      { Authorization: `Bearer 00000000-0000-0000-0000-000000000000.${"x".repeat(43)}` },
    ];
    for (const h of headers) {
      const res = await post(env, { ...h, "Content-Type": "application/json" }, { since: 0 });
      expect(res.status).toBe(401);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("unauthorized");
    }
  });
});

describe("POST /v1/sync: 競合(あとから更新した方が勝つ)", () => {
  it("新しい updated_at は古い保存を上書きする", async () => {
    const env = testEnv();
    const auth = await signup(env);
    await post(env, auth, { since: 0, changes: { records: [rec("2026-10-11", { screen: 0, updated_at: T0 - 5000 })] } });
    await post(env, auth, { since: 0, changes: { records: [rec("2026-10-11", { screen: 1, updated_at: T0 - 1000 })] } });
    const got = (await (await post(env, auth, { since: 0 })).json()) as SyncResult;
    expect(got.changes.records).toHaveLength(1);
    expect(got.changes.records[0]).toMatchObject({ screen: 1, updated_at: T0 - 1000 });
  });

  it("古い updated_at は、保存済みを上書きしない", async () => {
    const env = testEnv();
    const auth = await signup(env);
    await post(env, auth, { since: 0, changes: { records: [rec("2026-10-11", { screen: 1, updated_at: T0 - 1000 })] } });
    await post(env, auth, { since: 0, changes: { records: [rec("2026-10-11", { screen: 0, updated_at: T0 - 5000 })] } });
    const got = (await (await post(env, auth, { since: 0 })).json()) as SyncResult;
    expect(got.changes.records[0]).toMatchObject({ screen: 1, updated_at: T0 - 1000 });
  });

  it("同じ updated_at なら、保存済みを残す", async () => {
    const env = testEnv();
    const auth = await signup(env);
    await post(env, auth, { since: 0, changes: { records: [rec("2026-10-11", { screen: 1 })] } });
    await post(env, auth, { since: 0, changes: { records: [rec("2026-10-11", { screen: 0 })] } });
    const got = (await (await post(env, auth, { since: 0 })).json()) as SyncResult;
    expect(got.changes.records[0]!.screen).toBe(1);
  });

  it("設定も同じ規則(「ねる」の状態を含む)", async () => {
    const env = testEnv();
    const auth = await signup(env);
    await post(env, auth, { since: 0, changes: { settings: settings({ preset: "grow", pending_bed_ts: T0 - 9000, updated_at: T0 - 2000 }) } });
    await post(env, auth, { since: 0, changes: { settings: settings({ preset: "safe", pending_bed_ts: null, updated_at: T0 - 3000 }) } });
    let got = (await (await post(env, auth, { since: 0 })).json()) as SyncResult;
    expect(got.changes.settings).toMatchObject({ preset: "grow", pending_bed_ts: T0 - 9000 });
    await post(env, auth, { since: 0, changes: { settings: settings({ preset: "safe", pending_bed_ts: null, updated_at: T0 - 500 }) } });
    got = (await (await post(env, auth, { since: 0 })).json()) as SyncResult;
    expect(got.changes.settings).toMatchObject({ preset: "safe", pending_bed_ts: null });
  });

  it("端末の時計が進んでいても、updated_at はサーバー時刻までにそろえる", async () => {
    const env = testEnv();
    const auth = await signup(env);
    await post(env, auth, { since: 0, changes: { records: [rec("2026-10-11", { screen: 1, updated_at: T0 + 86_400_000 })] } });
    const got = (await (await post(env, auth, { since: 0 })).json()) as SyncResult;
    expect(got.changes.records[0]!.updated_at).toBe(T0);
    // 1 分あとの、ふつうの更新が勝てる
    vi.setSystemTime(T0 + 60_000);
    await post(env, auth, { since: 0, changes: { records: [rec("2026-10-11", { screen: 0, updated_at: T0 + 30_000 })] } });
    const after = (await (await post(env, auth, { since: 0 })).json()) as SyncResult;
    expect(after.changes.records[0]!.screen).toBe(0);
  });

  it("FX の取引は、決済で更新される", async () => {
    const env = testEnv();
    const auth = await signup(env);
    await post(env, auth, { since: 0, changes: { fx_trades: [trade("t1")] } });
    await post(env, auth, { since: 0, changes: { fx_trades: [trade("t1", { exit_rate: 150.9, exit_reason: "close", pnl: 10, settled_at: T0 - 10, updated_at: T0 - 10 })] } });
    const got = (await (await post(env, auth, { since: 0 })).json()) as { changes: { fx_trades: { pnl: number | null }[] } };
    expect(got.changes.fx_trades).toHaveLength(1);
    expect(got.changes.fx_trades[0]!.pnl).toBe(10);
  });
});

describe("POST /v1/sync: 入力の検証", () => {
  const bad: [string, unknown][] = [
    ["since がない", {}],
    ["since が負", { since: -1 }],
    ["日付の形が違う", { since: 0, changes: { records: [rec("2026/10/11")] } }],
    ["screen が 2", { since: 0, changes: { records: [rec("2026-10-11", { screen: 2 })] } }],
    ["分が範囲外", { since: 0, changes: { records: [rec("2026-10-11", { bed_min: 5000 })] } }],
    ["課題が 1 個", { since: 0, changes: { settings: settings({ tasks_json: '["bed"]' }) } }],
    ["課題が壊れた JSON", { since: 0, changes: { settings: settings({ tasks_json: "[" }) } }],
    ["preset が違う", { since: 0, changes: { settings: settings({ preset: "x" }) } }],
    ["台帳の kind が違う", { since: 0, changes: { fx_ledger: [{ id: "a", date: "2026-10-12", kind: "x", amount: 1, updated_at: 1 }] } }],
    ["行が多すぎる", { since: 0, changes: { records: Array.from({ length: 501 }, (_, i) => rec(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`)) } }],
  ];
  it.each(bad)("%s → 400(統一形式)", async (_name, body) => {
    const env = testEnv();
    const res = await post(env, await signup(env), body);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("invalid_request");
    expect(json.error.message.length).toBeGreaterThan(0);
  });

  it("JSON でない本文は 400", async () => {
    const env = testEnv();
    const res = await app.request("/v1/sync", { method: "POST", headers: await signup(env), body: "not json" }, env);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("invalid_json");
  });

  it("1 行でも不正なら、何も保存しない", async () => {
    const env = testEnv();
    const auth = await signup(env);
    await post(env, auth, { since: 0, changes: { records: [rec("2026-10-11"), rec("bad")] } });
    const got = (await (await post(env, auth, { since: 0 })).json()) as SyncResult;
    expect(got.changes.records).toEqual([]);
  });
});
