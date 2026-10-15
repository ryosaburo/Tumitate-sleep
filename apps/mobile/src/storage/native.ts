import * as SQLite from "expo-sqlite";
import { defaultSettings, parseFxOrderRow, parseRecordRow, parseSettingsRow, warn } from "./common";
import type { FxOrderRow, RecordRow, SettingsRow, Storage } from "./types";

const DB_NAME = "nekase.db";

/**
 * ネイティブ(iOS / Android)の実装。expo-sqlite。テーブルは計画書 §8.3 と同じ列名。
 * 薄い実装: 実機・シミュレータでの確認は、画面をつなぐステップで行う。
 */
export function createNativeStorage(): Storage {
  let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  const db = (): Promise<SQLite.SQLiteDatabase> => {
    dbPromise ??= (async () => {
      const d = await SQLite.openDatabaseAsync(DB_NAME);
      await d.execAsync(`
        CREATE TABLE IF NOT EXISTS records (
          date TEXT PRIMARY KEY,
          bed_min INTEGER, wake_min INTEGER,
          screen INTEGER NOT NULL DEFAULT 0,
          caffeine INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          target_bed TEXT, target_wake TEXT, start_date TEXT,
          tasks_json TEXT, preset TEXT,
          pending_bed_ts INTEGER, updated_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS fx_orders (
          date TEXT PRIMARY KEY,
          pair TEXT NOT NULL, side TEXT NOT NULL,
          notional INTEGER NOT NULL, entry_rate REAL NOT NULL,
          stop_pct REAL NOT NULL, gauge INTEGER NOT NULL,
          reason TEXT, updated_at INTEGER NOT NULL DEFAULT 0
        );
      `);
      return d;
    })();
    return dbPromise;
  };

  const readSettings = async (): Promise<SettingsRow | null> => {
    try {
      const row = await (await db()).getFirstAsync("SELECT * FROM settings WHERE id = 1");
      if (!row) return null;
      const parsed = parseSettingsRow(row);
      if (!parsed) warn("壊れた設定を捨てました", row);
      return parsed;
    } catch (e) {
      warn("設定を読めませんでした。空として扱います", e);
      return null;
    }
  };

  const writeSettings = async (r: SettingsRow): Promise<void> => {
    await (
      await db()
    ).runAsync(
      `INSERT OR REPLACE INTO settings
        (id, target_bed, target_wake, start_date, tasks_json, preset, pending_bed_ts, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
      [r.target_bed, r.target_wake, r.start_date, r.tasks_json, r.preset, r.pending_bed_ts, r.updated_at],
    );
  };

  const parseAll = (rows: unknown[]): RecordRow[] =>
    rows.flatMap((x) => {
      const row = parseRecordRow(x);
      if (!row) warn("壊れた記録を 1 件捨てました", x);
      return row ? [row] : [];
    });

  return {
    persistent: true,
    async getRecords() {
      try {
        return parseAll(await (await db()).getAllAsync("SELECT * FROM records ORDER BY date ASC"));
      } catch (e) {
        warn("記録を読めませんでした。空として扱います", e);
        return [];
      }
    },
    async getRecord(date) {
      try {
        const row = await (await db()).getFirstAsync("SELECT * FROM records WHERE date = ?", [date]);
        return row ? (parseAll([row])[0] ?? null) : null;
      } catch (e) {
        warn("記録を読めませんでした。空として扱います", e);
        return null;
      }
    },
    async putRecord(r) {
      await (
        await db()
      ).runAsync(
        `INSERT OR REPLACE INTO records (date, bed_min, wake_min, screen, caffeine, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [r.date, r.bed_min, r.wake_min, r.screen, r.caffeine, r.updated_at],
      );
    },
    getSettings: readSettings,
    putSettings: writeSettings,
    async getPendingBed() {
      return (await readSettings())?.pending_bed_ts ?? null;
    },
    async setPendingBed(ts, now) {
      const cur = (await readSettings()) ?? defaultSettings(now);
      await writeSettings({ ...cur, pending_bed_ts: ts, updated_at: now });
    },
    async getFxOrders() {
      try {
        const rows = await (await db()).getAllAsync("SELECT * FROM fx_orders ORDER BY date ASC");
        return rows.flatMap((x): FxOrderRow[] => {
          const row = parseFxOrderRow(x);
          if (!row) warn("壊れた注文を 1 件捨てました", x);
          return row ? [row] : [];
        });
      } catch (e) {
        warn("注文を読めませんでした。空として扱います", e);
        return [];
      }
    },
    async putFxOrder(r) {
      await (
        await db()
      ).runAsync(
        `INSERT OR REPLACE INTO fx_orders
          (date, pair, side, notional, entry_rate, stop_pct, gauge, reason, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.date, r.pair, r.side, r.notional, r.entry_rate, r.stop_pct, r.gauge, r.reason, r.updated_at],
      );
    },
    async clear() {
      const d = await db();
      await d.execAsync("DELETE FROM records; DELETE FROM settings; DELETE FROM fx_orders;");
    },
  };
}
