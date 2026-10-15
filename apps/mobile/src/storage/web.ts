import { defaultSettings, parseFxOrderRow, parseRecordRow, parseSettingsRow, warn } from "./common";
import type { FxOrderRow, RecordRow, SettingsRow, Storage } from "./types";

/** localStorage と同じ形の最小インターフェース(テストでは疑似のものを渡す)。 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const WEB_STORAGE_KEY = "nekase.v2";

interface Saved {
  records: Record<string, RecordRow>;
  settings: SettingsRow | null;
  /** FX チャレンジの注文。日付がキー */
  fx_orders: Record<string, FxOrderRow>;
}

/** ブラウザの保存が使えないときのメモリ上の代用。 */
export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

/**
 * Web 版の実装。1 つのキーに { records, settings } を JSON で保存する。
 * store を省くと window.localStorage を使い、使えなければメモリ上に切り替える(persistent = false)。
 */
export function createWebStorage(store?: KeyValueStore): Storage {
  let kv: KeyValueStore;
  let persistent = true;
  if (store) {
    kv = store;
  } else {
    try {
      kv = globalThis.localStorage;
      kv.getItem(WEB_STORAGE_KEY); // 使えない環境ではここで例外になる
    } catch (e) {
      warn("ブラウザの保存が使えないため、このタブの間だけ保持します", e);
      kv = memoryStore();
      persistent = false;
    }
  }

  const read = (): Saved => {
    const empty: Saved = { records: {}, settings: null, fx_orders: {} };
    let raw: string | null;
    try {
      raw = kv.getItem(WEB_STORAGE_KEY);
    } catch (e) {
      warn("保存データを読めませんでした。空として扱います", e);
      return empty;
    }
    if (raw === null) return empty;
    let obj: unknown;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      warn("保存データが壊れています。空として扱います", e);
      return empty;
    }
    if (typeof obj !== "object" || obj === null) {
      warn("保存データの形が違います。空として扱います");
      return empty;
    }
    const o = obj as { records?: unknown; settings?: unknown; fx_orders?: unknown };
    const out: Saved = { records: {}, settings: null, fx_orders: {} };
    if (typeof o.records === "object" && o.records !== null) {
      for (const v of Object.values(o.records)) {
        const row = parseRecordRow(v);
        if (row) out.records[row.date] = row;
        else warn("壊れた記録を 1 件捨てました", v);
      }
    }
    if (typeof o.fx_orders === "object" && o.fx_orders !== null) {
      for (const v of Object.values(o.fx_orders)) {
        const row = parseFxOrderRow(v);
        if (row) out.fx_orders[row.date] = row;
        else warn("壊れた注文を 1 件捨てました", v);
      }
    }
    if (o.settings != null) {
      out.settings = parseSettingsRow(o.settings);
      if (!out.settings) warn("壊れた設定を捨てました", o.settings);
    }
    return out;
  };

  const write = (s: Saved): void => {
    try {
      kv.setItem(WEB_STORAGE_KEY, JSON.stringify(s));
    } catch (e) {
      warn("保存できませんでした(容量やブラウザ設定を確認してください)", e);
    }
  };

  return {
    persistent,
    async getRecords() {
      return Object.values(read().records).sort((a, b) => a.date.localeCompare(b.date));
    },
    async getRecord(date) {
      return read().records[date] ?? null;
    },
    async putRecord(row) {
      const s = read();
      s.records[row.date] = row;
      write(s);
    },
    async getSettings() {
      return read().settings;
    },
    async putSettings(row) {
      const s = read();
      s.settings = row;
      write(s);
    },
    async getPendingBed() {
      return read().settings?.pending_bed_ts ?? null;
    },
    async setPendingBed(ts, now) {
      const s = read();
      s.settings = { ...(s.settings ?? defaultSettings(now)), pending_bed_ts: ts, updated_at: now };
      write(s);
    },
    async getFxOrders() {
      return Object.values(read().fx_orders).sort((a, b) => a.date.localeCompare(b.date));
    },
    async putFxOrder(row) {
      const s = read();
      s.fx_orders[row.date] = row;
      write(s);
    },
    async clear() {
      try {
        kv.removeItem(WEB_STORAGE_KEY);
      } catch (e) {
        warn("削除できませんでした", e);
      }
    },
  };
}
