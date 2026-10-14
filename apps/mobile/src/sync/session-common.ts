import type { Session, SessionStore } from "./types";

export const SESSION_KEY = "nekase.session.v1";

/** localStorage と同じ形の最小インターフェース */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryKeyValue(): KeyValue {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

/** 保存された文字列を Session に戻す。壊れていたら null(= 未設定として扱い、新しいアカウントを作る)。 */
export function parseSession(raw: string | null): Session | null {
  if (raw === null) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o.accountId !== "string" || typeof o.token !== "string") return null;
    const since = typeof o.since === "number" && o.since >= 0 ? o.since : 0;
    const pushedAt = typeof o.pushedAt === "number" && o.pushedAt >= 0 ? o.pushedAt : 0;
    return { accountId: o.accountId, token: o.token, since, pushedAt };
  } catch {
    return null;
  }
}

export function webSessionStore(kv: KeyValue): SessionStore {
  return {
    async load() {
      try {
        return parseSession(kv.getItem(SESSION_KEY));
      } catch {
        return null;
      }
    },
    async save(s) {
      kv.setItem(SESSION_KEY, JSON.stringify(s));
    },
    async clear() {
      try {
        kv.removeItem(SESSION_KEY);
      } catch {
        // 消せなくても、次の読み込みで壊れた値として扱う
      }
    },
  };
}
