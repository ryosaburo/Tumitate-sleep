import { describe, expect, it, vi } from "vitest";
import { createWebStorage, memoryStore } from "../storage/web";
import type { RecordRow, SettingsRow, Storage } from "../storage/types";
import { createSyncEngine, SINCE_OVERLAP_MS } from "./engine";
import { formatCode, linkErrorMessage, remaining } from "./messages";
import { memoryKeyValue, parseSession, webSessionStore } from "./session-common";
import { ApiFailure, type Changes, type Credentials, type Session, type SyncApi } from "./types";

const rec = (date: string, updated_at: number, over: Partial<RecordRow> = {}): RecordRow => ({
  date,
  bed_min: 210,
  wake_min: 630,
  screen: 0,
  caffeine: 0,
  updated_at,
  ...over,
});
const settings = (updated_at: number, over: Partial<SettingsRow> = {}): SettingsRow => ({
  target_bed: "23:30",
  target_wake: "06:30",
  start_date: null,
  tasks_json: '["bed","screen","caffeine"]',
  preset: "bal",
  pending_bed_ts: null,
  updated_at,
  ...over,
});

const strip = <T extends { synced_at: number }>(row: T): Omit<T, "synced_at"> => {
  const { synced_at, ...rest } = row;
  void synced_at;
  return rest;
};

/** API の本物と同じ規則(行ごとに、updated_at が新しい方だけ採用。synced_at >= since を返す)の疑似サーバー */
function fakeServer() {
  let time = 1_000_000;
  const accounts = new Map<string, { token: string; records: Map<string, RecordRow & { synced_at: number }>; settings: (SettingsRow & { synced_at: number }) | null }>();
  const codes = new Map<string, string>();
  let n = 0;
  const calls = { sync: 0, createAccount: 0 };
  const control = { offline: false, failSyncOnce: false };
  const check = () => {
    if (control.offline) throw new ApiFailure("network");
  };
  const auth = (c: Credentials) => {
    const a = accounts.get(c.accountId);
    if (!a || a.token !== c.token) throw new ApiFailure("auth", "unauthorized");
    return a;
  };
  const api: SyncApi = {
    async createAccount() {
      check();
      calls.createAccount++;
      const accountId = `acc-${++n}`;
      accounts.set(accountId, { token: `tok-${n}`, records: new Map(), settings: null });
      return { accountId, token: `tok-${n}` };
    },
    async sync(c, since, changes) {
      check();
      calls.sync++;
      if (control.failSyncOnce) {
        control.failSyncOnce = false;
        throw new ApiFailure("network");
      }
      const a = auth(c);
      const serverTime = ++time;
      for (const r of changes.records) {
        const old = a.records.get(r.date);
        if (!old || r.updated_at > old.updated_at) a.records.set(r.date, { ...r, updated_at: Math.min(r.updated_at, serverTime), synced_at: serverTime });
      }
      if (changes.settings && (!a.settings || changes.settings.updated_at > a.settings.updated_at)) a.settings = { ...changes.settings, synced_at: serverTime };
      const out: Changes = {
        records: [...a.records.values()].filter((r) => r.synced_at >= since).map((r) => strip(r)),
        settings: a.settings && a.settings.synced_at >= since ? strip(a.settings) : null,
      };
      return { serverTime, changes: out };
    },
    async linkStart(c) {
      check();
      auth(c);
      const code = `CODE${n}${codes.size}XX`.slice(0, 8);
      codes.set(code, c.accountId);
      return { code, expiresAt: time + 600_000 };
    },
    async aiOrder() {
      return { decision: { side: "skip", comment: "" } } as const;
    },
    async linkRedeem(code) {
      check();
      const id = codes.get(code);
      if (!id) throw new ApiFailure("http", "invalid_code");
      codes.delete(code);
      return { accountId: id, token: accounts.get(id)!.token };
    },
  };
  return { api, calls, control, accounts };
}

function device(server: ReturnType<typeof fakeServer>, clock = { t: 5_000_000 }) {
  const storage: Storage = createWebStorage(memoryStore());
  const sessions = webSessionStore(memoryKeyValue());
  const onApplied = vi.fn();
  const engine = createSyncEngine({ storage, api: server.api, sessions, now: () => clock.t, onApplied });
  return { storage, sessions, engine, onApplied, clock };
}

describe("同期", () => {
  it("初回は、アカウントを作って、手元の全データを送る", async () => {
    const server = fakeServer();
    const a = device(server);
    await a.storage.putRecord(rec("2026-10-11", 100));
    await a.storage.putSettings(settings(100));
    const r = await a.engine.sync();
    expect(r).toEqual({ ok: true, pulled: 0 });
    expect(server.calls.createAccount).toBe(1);
    const acc = [...server.accounts.values()][0]!;
    expect([...acc.records.keys()]).toEqual(["2026-10-11"]);
    expect(acc.settings?.preset).toBe("bal");
    // 2 回目は、アカウントを作り直さない
    await a.engine.sync();
    expect(server.calls.createAccount).toBe(1);
  });

  it("2 台目に、1 台目の記録が届く。あとから更新した方が勝つ", async () => {
    const server = fakeServer();
    const a = device(server);
    await a.storage.putRecord(rec("2026-10-11", 100, { screen: 1 }));
    await a.storage.putRecord(rec("2026-10-12", 100));
    await a.engine.sync();
    const link = await a.engine.startLink();

    const b = device(server);
    await b.storage.putRecord(rec("2026-10-11", 200, { screen: 0 })); // B の方が新しい
    await b.storage.putRecord(rec("2026-10-13", 50)); // B だけにある
    const creds = await b.engine.redeemLink(link.code);
    expect((await b.engine.applyLink(creds, "merge")).ok).toBe(true);

    expect((await b.storage.getRecords()).map((r) => r.date)).toEqual(["2026-10-11", "2026-10-12", "2026-10-13"]);
    expect((await b.storage.getRecord("2026-10-11"))?.screen).toBe(0); // B の新しい方
    // A にも、B の記録が届く
    await a.engine.sync();
    expect((await a.storage.getRecords()).map((r) => r.date)).toEqual(["2026-10-11", "2026-10-12", "2026-10-13"]);
    expect((await a.storage.getRecord("2026-10-11"))?.screen).toBe(0);
    expect(a.onApplied).toHaveBeenCalled();
  });

  it("手元の方が新しい行は、サーバーの古い行で上書きしない", async () => {
    const server = fakeServer();
    const clock = { t: 5_000_000 };
    const a = device(server, clock);
    await a.storage.putRecord(rec("2026-10-11", 4_000_000, { screen: 1 }));
    await a.engine.sync();
    clock.t = 5_000_500;
    await a.storage.putRecord(rec("2026-10-11", clock.t, { screen: 0 }));
    await a.engine.sync();
    expect((await a.storage.getRecord("2026-10-11"))?.screen).toBe(0);
    expect([...server.accounts.values()][0]!.records.get("2026-10-11")?.screen).toBe(0);
  });

  it("上書きで引き継ぐと、端末内のデータは消えて、サーバーのデータになる", async () => {
    const server = fakeServer();
    const a = device(server);
    await a.storage.putRecord(rec("2026-10-11", 100));
    await a.engine.sync();
    const link = await a.engine.startLink();

    const b = device(server);
    await b.storage.putRecord(rec("2026-10-20", 999));
    await b.engine.applyLink(await b.engine.redeemLink(link.code), "overwrite");
    expect((await b.storage.getRecords()).map((r) => r.date)).toEqual(["2026-10-11"]);
    expect(b.onApplied).toHaveBeenCalled();
  });

  it("オフラインでも記録でき、復帰したら、そのとき送られる(再試行)", async () => {
    const server = fakeServer();
    const clock = { t: 5_000_000 };
    const a = device(server, clock);
    await a.engine.sync();
    server.control.offline = true;
    await a.storage.putRecord(rec("2026-10-11", 6_000_000));
    clock.t = 6_000_100;
    expect(await a.engine.sync()).toEqual({ ok: false, reason: "network" });
    expect(await a.engine.sync()).toEqual({ ok: false, reason: "network" });
    expect((await a.storage.getRecords()).length).toBe(1); // 端末内には残っている
    expect([...server.accounts.values()][0]!.records.size).toBe(0);

    server.control.offline = false;
    clock.t = 6_000_200;
    expect(await a.engine.sync()).toEqual({ ok: true, pulled: 0 });
    expect([...server.accounts.values()][0]!.records.has("2026-10-11")).toBe(true);
  });

  it("送信が途中で失敗したら、since と pushedAt を進めない", async () => {
    const server = fakeServer();
    const a = device(server);
    await a.engine.sync();
    const before = (await a.sessions.load()) as Session;
    await a.storage.putRecord(rec("2026-10-11", 9_000_000));
    server.control.failSyncOnce = true;
    expect((await a.engine.sync()).ok).toBe(false);
    expect(await a.sessions.load()).toEqual(before);
    expect((await a.engine.sync()).ok).toBe(true);
    expect([...server.accounts.values()][0]!.records.has("2026-10-11")).toBe(true);
  });

  it("アカウントを作れなくても、端末内のデータは変わらず、例外も投げない", async () => {
    const server = fakeServer();
    server.control.offline = true;
    const a = device(server);
    await a.storage.putRecord(rec("2026-10-11", 100));
    expect(await a.engine.sync()).toEqual({ ok: false, reason: "network" });
    expect(await a.sessions.load()).toBeNull();
    expect((await a.storage.getRecords()).length).toBe(1);
  });

  it("認証に失敗したら auth を返す(同期を繰り返さない)", async () => {
    const server = fakeServer();
    const a = device(server);
    await a.sessions.save({ accountId: "acc-x", token: "bad", since: 0, pushedAt: 0 });
    expect(await a.engine.sync()).toEqual({ ok: false, reason: "auth" });
  });

  it("成功したら、since は serverTime より少し戻した値になる", async () => {
    const server = fakeServer();
    const a = device(server);
    await a.engine.sync();
    const s = (await a.sessions.load()) as Session;
    expect(s.since).toBe(Math.max(0, 1_000_001 - SINCE_OVERLAP_MS));
    expect(s.pushedAt).toBe(5_000_000);
  });

  it("同時に呼んでも、同時には走らない(走行中の呼び出しは、終わったあとに 1 回まとめる)", async () => {
    const server = fakeServer();
    const a = device(server);
    await a.engine.sync(); // アカウント作成を済ませる
    server.calls.sync = 0;
    const p = [a.engine.sync(), a.engine.sync(), a.engine.sync()];
    await Promise.all(p);
    expect(server.calls.sync).toBe(2);
  });

  it("記録が 500 件を超えても、分けて送る", async () => {
    const server = fakeServer();
    const a = device(server);
    for (let i = 0; i < 501; i++) {
      const d = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
      await a.storage.putRecord(rec(d, 100 + i));
    }
    server.calls.sync = 0;
    expect((await a.engine.sync()).ok).toBe(true);
    expect(server.calls.sync).toBe(2);
    expect([...server.accounts.values()][0]!.records.size).toBe(501);
  });

  it("コードが違うと、ApiFailure が投げられる", async () => {
    const server = fakeServer();
    const a = device(server);
    await expect(a.engine.redeemLink("ZZZZZZZZ")).rejects.toMatchObject({ code: "invalid_code" });
  });

  it("detach すると、次の同期で新しいアカウントを作る", async () => {
    const server = fakeServer();
    const a = device(server);
    await a.engine.sync();
    await a.engine.detach();
    await a.engine.sync();
    expect(server.calls.createAccount).toBe(2);
  });
});

describe("文言と整形", () => {
  it("引き継ぎのエラーを、原因ごとに区別する", () => {
    const m = (e: ApiFailure) => linkErrorMessage(e);
    const all = [
      m(new ApiFailure("http", "invalid_code")),
      m(new ApiFailure("http", "code_used")),
      m(new ApiFailure("http", "code_expired")),
      m(new ApiFailure("http", "too_many_attempts")),
      m(new ApiFailure("network")),
    ];
    expect(new Set(all).size).toBe(5);
    expect(all[2]).toContain("有効期限");
    expect(all[3]).toContain("試行回数");
    expect(all[4]).toContain("通信");
  });

  it("残り時間を m:ss で出し、期限を過ぎたら null", () => {
    expect(remaining(10 * 60_000, 0)).toBe("10:00");
    expect(remaining(65_000, 0)).toBe("1:05");
    expect(remaining(500, 0)).toBe("0:01");
    expect(remaining(1000, 1000)).toBeNull();
  });

  it("コードを 4 文字ずつに区切る", () => {
    expect(formatCode("ABCD2345")).toBe("ABCD-2345");
  });

  it("壊れたセッションは null として扱う", () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession("{")).toBeNull();
    expect(parseSession('{"accountId":1}')).toBeNull();
    expect(parseSession('{"accountId":"a","token":"t"}')).toEqual({ accountId: "a", token: "t", since: 0, pushedAt: 0 });
  });
});
