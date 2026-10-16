import { newer } from "../storage/common";
import type { RecordRow, Storage } from "../storage/types";
import { ApiFailure, type AiOrderRequest, type Changes, type Credentials, type LinkCode, type Session, type SessionStore, type SyncApi } from "./types";

/** 1 回の送信で送る記録の上限(API の上限は 500 件) */
export const CHUNK = 500;
/**
 * 次の since を、前回の serverTime より少し戻す。
 * 別の端末の送信が、こちらの読み取りより後に確定しても、取りこぼさないため。重複して受け取っても害はない。
 */
export const SINCE_OVERLAP_MS = 60_000;

export type SyncResult =
  | { ok: true; pulled: number }
  | { ok: false; reason: "network" | "auth" | "server" };

export type LinkMode = "overwrite" | "merge";

export interface EngineDeps {
  storage: Storage;
  api: SyncApi;
  sessions: SessionStore;
  /** 現在時刻(ミリ秒)。テストでは固定する */
  now: () => number;
  /** 他の端末の変更を端末内に取り込んだとき(画面の再読み込み用) */
  onApplied?: () => void;
}

export interface SyncEngine {
  /** 同期する。通信できなくても例外は投げず、結果で返す。同時に 2 つ走らせない(走行中なら、終わったあとにもう 1 回) */
  sync(): Promise<SyncResult>;
  /** 引き継ぎコードを発行する(1 台目)。アカウントがなければ先に作る */
  startLink(): Promise<LinkCode>;
  /** コードを使って、同じアカウントの認証情報を受け取る(2 台目)。まだ端末には反映しない */
  redeemLink(code: string): Promise<Credentials>;
  /** 受け取った認証情報を反映する。overwrite は端末内データを消して取り込み、merge は両方を残して新しい方を採用 */
  applyLink(creds: Credentials, mode: LinkMode): Promise<SyncResult>;
  /** AI に今日の注文を決めてもらう(計画書 §6.6)。アカウントがなければ先に作る。失敗は ApiFailure を投げる */
  requestAiOrder(req: AiOrderRequest): Promise<{ decision: import("@nekase/core").AiDecision }>;
  /** この端末を、アカウントから外す(リセット用)。端末内データは消さない */
  detach(): Promise<void>;
}

const failure = (e: unknown): SyncResult => {
  if (e instanceof ApiFailure) return { ok: false, reason: e.kind === "network" ? "network" : e.kind === "auth" ? "auth" : "server" };
  return { ok: false, reason: "server" };
};

export function createSyncEngine(deps: EngineDeps): SyncEngine {
  const { storage, api, sessions, now } = deps;
  let running: Promise<SyncResult> | null = null;
  let again = false;

  const ensureSession = async (): Promise<Session> => {
    const cur = await sessions.load();
    if (cur) return cur;
    const c = await api.createAccount();
    const s: Session = { ...c, since: 0, pushedAt: 0 };
    await sessions.save(s);
    return s;
  };

  /** 他の端末の行を取り込む。手元より新しい行だけ上書きする。取り込んだ件数を返す。 */
  const apply = async (changes: Changes): Promise<number> => {
    let n = 0;
    for (const r of changes.records) {
      const mine = await storage.getRecord(r.date);
      if (!mine || newer(mine, r) !== mine) {
        await storage.putRecord(r);
        n++;
      }
    }
    if (changes.settings) {
      const mine = await storage.getSettings();
      if (!mine || newer(mine, changes.settings) !== mine) {
        await storage.putSettings(changes.settings);
        n++;
      }
    }
    return n;
  };

  const once = async (): Promise<SyncResult> => {
    try {
      let s = await ensureSession();
      const startedAt = now();
      const records = (await storage.getRecords()).filter((r: RecordRow) => r.updated_at >= s.pushedAt);
      const settings = await storage.getSettings();
      const sendSettings = settings && settings.updated_at >= s.pushedAt ? settings : null;

      // 記録が多いときは、500 件ずつ送る。最後の応答の serverTime を使う
      const chunks: RecordRow[][] = [];
      for (let i = 0; i < records.length; i += CHUNK) chunks.push(records.slice(i, i + CHUNK));
      if (chunks.length === 0) chunks.push([]);

      let pulled = 0;
      let serverTime = 0;
      for (const [i, rs] of chunks.entries()) {
        const res = await api.sync(s, s.since, { records: rs, settings: i === 0 ? sendSettings : null });
        pulled += await apply(res.changes);
        serverTime = res.serverTime;
      }
      s = { ...s, since: Math.max(0, serverTime - SINCE_OVERLAP_MS), pushedAt: startedAt };
      await sessions.save(s);
      if (pulled > 0) deps.onApplied?.();
      return { ok: true, pulled };
    } catch (e) {
      // since と pushedAt は進めない。次の同期で、同じ変更をもう一度送る(サーバーは新しい方だけ採用するので、重複しても安全)
      return failure(e);
    }
  };

  const sync = (): Promise<SyncResult> => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        let r = await once();
        while (again && r.ok) {
          again = false;
          r = await once();
        }
        return r;
      } finally {
        again = false;
        running = null;
      }
    })();
    return running;
  };

  return {
    sync,
    async startLink() {
      const s = await ensureSession();
      return api.linkStart(s);
    },
    redeemLink: (code) => api.linkRedeem(code),
    async requestAiOrder(req) {
      const s = await ensureSession();
      return api.aiOrder(s, req);
    },
    async applyLink(creds, mode) {
      if (mode === "overwrite") await storage.clear();
      // since と pushedAt を 0 にして、端末内の全データを新しいアカウントに送る(merge のとき、手元の記録を残すため)
      await sessions.save({ ...creds, since: 0, pushedAt: 0 });
      const r = await sync();
      if (mode === "overwrite") deps.onApplied?.();
      return r;
    },
    detach: () => sessions.clear(),
  };
}
