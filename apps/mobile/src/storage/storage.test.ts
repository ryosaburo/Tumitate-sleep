import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings, newer, parseFxOrderRow, parseRecordRow, parseSettingsRow } from "./common";
import type { FxOrderRow, RecordRow } from "./types";
import { createWebStorage, memoryStore, WEB_STORAGE_KEY } from "./web";

const rec = (date: string, over: Partial<RecordRow> = {}): RecordRow => ({
  date,
  bed_min: 210,
  wake_min: 630,
  screen: 1,
  caffeine: 0,
  updated_at: 1000,
  ...over,
});

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("Web 実装: 記録", () => {
  it("書いたものを読める。日付の昇順で返る", async () => {
    const s = createWebStorage(memoryStore());
    await s.putRecord(rec("2026-10-12"));
    await s.putRecord(rec("2026-10-11"));
    expect((await s.getRecords()).map((r) => r.date)).toEqual(["2026-10-11", "2026-10-12"]);
    expect(await s.getRecord("2026-10-12")).toEqual(rec("2026-10-12"));
    expect(await s.getRecord("2026-01-01")).toBeNull();
  });
  it("同じ日付は上書きされる", async () => {
    const s = createWebStorage(memoryStore());
    await s.putRecord(rec("2026-10-11"));
    await s.putRecord(rec("2026-10-11", { bed_min: null, updated_at: 2000 }));
    const all = await s.getRecords();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ bed_min: null, updated_at: 2000 });
  });
  it("別のインスタンスでも同じ保存先から読める(再読み込みの想定)", async () => {
    const kv = memoryStore();
    await createWebStorage(kv).putRecord(rec("2026-10-11"));
    expect(await createWebStorage(kv).getRecords()).toHaveLength(1);
  });
});

describe("Web 実装: 設定と「ねる」の途中状態", () => {
  it("設定がなければ null", async () => {
    expect(await createWebStorage(memoryStore()).getSettings()).toBeNull();
  });
  it("設定を書いて読める", async () => {
    const s = createWebStorage(memoryStore());
    const row = { ...defaultSettings(5), start_date: "2026-10-11", preset: "grow" };
    await s.putSettings(row);
    expect(await s.getSettings()).toEqual(row);
  });
  it("pendingBed: 設定がなくても保存でき、他の設定を壊さない", async () => {
    const s = createWebStorage(memoryStore());
    expect(await s.getPendingBed()).toBeNull();
    await s.setPendingBed(1234, 10);
    expect(await s.getPendingBed()).toBe(1234);
    expect(await s.getSettings()).toMatchObject({ target_bed: "23:30", pending_bed_ts: 1234, updated_at: 10 });

    await s.putSettings({ ...(await s.getSettings())!, preset: "safe" });
    await s.setPendingBed(null, 20);
    expect(await s.getPendingBed()).toBeNull();
    expect((await s.getSettings())?.preset).toBe("safe");
  });
  it("clear で全部消える", async () => {
    const s = createWebStorage(memoryStore());
    await s.putRecord(rec("2026-10-11"));
    await s.setPendingBed(1, 1);
    await s.clear();
    expect(await s.getRecords()).toEqual([]);
    expect(await s.getSettings()).toBeNull();
  });
});

describe("壊れた保存データでも落ちない", () => {
  const withRaw = (raw: string) => {
    const kv = memoryStore();
    kv.setItem(WEB_STORAGE_KEY, raw);
    return createWebStorage(kv);
  };
  it("JSON として壊れている → 空として扱い、警告を出す", async () => {
    const s = withRaw("{ここは壊れている");
    expect(await s.getRecords()).toEqual([]);
    expect(await s.getSettings()).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
  it("形が違う(配列・数値など) → 空", async () => {
    for (const raw of ["[]", "42", "null", '"abc"']) {
      expect(await withRaw(raw).getRecords()).toEqual([]);
    }
  });
  it("壊れた行だけ捨て、正しい行は残す", async () => {
    const s = withRaw(
      JSON.stringify({
        records: { a: rec("2026-10-11"), b: { date: "きのう" }, c: rec("2026-10-12", { screen: 5 as 1 }) },
        settings: { target_bed: "99:99" },
      }),
    );
    expect((await s.getRecords()).map((r) => r.date)).toEqual(["2026-10-11"]);
    expect(warn).toHaveBeenCalledTimes(3); // 壊れた記録 2 件 + 壊れた設定 1 件
    expect(await s.getSettings()).toBeNull();
  });
  it("壊れたあとでも、書き込めば復旧する", async () => {
    const s = withRaw("壊れている");
    await s.putRecord(rec("2026-10-11"));
    expect(await s.getRecords()).toHaveLength(1);
  });
  it("読み書きで例外を投げる保存先でも落ちない", async () => {
    const boom = () => {
      throw new Error("QuotaExceeded");
    };
    const s = createWebStorage({ getItem: boom, setItem: boom, removeItem: boom });
    expect(await s.getRecords()).toEqual([]);
    await expect(s.putRecord(rec("2026-10-11"))).resolves.toBeUndefined();
    await expect(s.clear()).resolves.toBeUndefined();
  });
});

describe("検証と更新時刻", () => {
  it("parseRecordRow: 範囲外の分・不正な日付を弾く", () => {
    expect(parseRecordRow(rec("2026-10-11"))).not.toBeNull();
    expect(parseRecordRow(rec("2026-10-11", { bed_min: 99999 }))).toBeNull();
    expect(parseRecordRow(rec("2026/10/11"))).toBeNull();
    expect(parseRecordRow(rec("2026-10-11", { updated_at: NaN }))).toBeNull();
    expect(parseRecordRow(null)).toBeNull();
  });
  it("parseSettingsRow: 課題は 2〜3 個、既知のキーだけ", () => {
    const ok = defaultSettings(1);
    expect(parseSettingsRow(ok)).not.toBeNull();
    expect(parseSettingsRow({ ...ok, tasks_json: '["bed"]' })).toBeNull();
    expect(parseSettingsRow({ ...ok, tasks_json: '["bed","wake","screen","caffeine"]' })).toBeNull();
    expect(parseSettingsRow({ ...ok, tasks_json: '["bed","bed"]' })).toBeNull();
    expect(parseSettingsRow({ ...ok, tasks_json: '["bed","sleepy"]' })).toBeNull();
    expect(parseSettingsRow({ ...ok, tasks_json: "壊れ" })).toBeNull();
    expect(parseSettingsRow({ ...ok, preset: "yolo" })).toBeNull();
  });
  it("newer: あとから更新した方を選ぶ。同時刻は手元(a)", () => {
    const a = rec("2026-10-11", { updated_at: 1 });
    const b = rec("2026-10-11", { updated_at: 2 });
    expect(newer(a, b)).toBe(b);
    expect(newer(b, a)).toBe(b);
    expect(newer(a, { ...a })).toBe(a);
  });
});

const fx = (date: string, over: Partial<FxOrderRow> = {}): FxOrderRow => ({
  date,
  pair: "USD/JPY",
  side: "buy",
  notional: 2000,
  entry_rate: 150.4,
  stop_pct: 1,
  gauge: 80,
  reason: null,
  placed_by: "user",
  ai_comment: null,
  updated_at: 1000,
  ...over,
});

describe("Web 実装: FX の注文", () => {
  it("書いたものを読める。日付の昇順。同じ日付は上書き", async () => {
    const s = createWebStorage(memoryStore());
    await s.putFxOrder(fx("2026-10-12"));
    await s.putFxOrder(fx("2026-10-11"));
    await s.putFxOrder(fx("2026-10-12", { side: "sell", updated_at: 2000 }));
    const all = await s.getFxOrders();
    expect(all.map((r) => r.date)).toEqual(["2026-10-11", "2026-10-12"]);
    expect(all[1]).toMatchObject({ side: "sell", updated_at: 2000 });
  });
  it("再読み込みしても残り、clear で消える。記録とは独立", async () => {
    const kv = memoryStore();
    const s = createWebStorage(kv);
    await s.putRecord(rec("2026-10-11"));
    await s.putFxOrder(fx("2026-10-11"));
    expect(await createWebStorage(kv).getFxOrders()).toHaveLength(1);
    await s.clear();
    expect(await s.getFxOrders()).toEqual([]);
  });
  it("壊れた注文は捨てる", async () => {
    const kv = memoryStore();
    kv.setItem(WEB_STORAGE_KEY, JSON.stringify({ records: {}, settings: null, fx_orders: { a: fx("2026-10-11"), b: { date: "x" } } }));
    expect(await createWebStorage(kv).getFxOrders()).toHaveLength(1);
  });
  it("検証: 損切りが 3 択以外・ゲージが範囲外は null", () => {
    expect(parseFxOrderRow(fx("2026-10-11"))).not.toBeNull();
    expect(parseFxOrderRow({ ...fx("2026-10-11"), stop_pct: 3 })).toBeNull();
    expect(parseFxOrderRow({ ...fx("2026-10-11"), gauge: 101 })).toBeNull();
    expect(parseFxOrderRow({ ...fx("2026-10-11"), notional: 0 })).toBeNull();
  });
  it("古い保存(placed_by なし)は、自分の注文として読む", () => {
    const old: Record<string, unknown> = { ...fx("2026-10-11") };
    delete old.placed_by;
    delete old.ai_comment;
    expect(parseFxOrderRow(old)).toMatchObject({ placed_by: "user", ai_comment: null });
  });
  it("AI の見送り(skip)は、金額 0・AI の注文のときだけ有効", () => {
    const skip = fx("2026-10-11", { side: "skip", notional: 0, placed_by: "ai", ai_comment: "様子を見ます" });
    expect(parseFxOrderRow(skip)).not.toBeNull();
    expect(parseFxOrderRow({ ...skip, notional: 1000 })).toBeNull();
    expect(parseFxOrderRow({ ...skip, placed_by: "user" })).toBeNull();
    expect(parseFxOrderRow({ ...skip, placed_by: "x" })).toBeNull();
  });
  it("AI の注文を保存して読める", async () => {
    const s = createWebStorage(memoryStore());
    await s.putFxOrder(fx("2026-10-11", { placed_by: "ai", ai_comment: "飛びつきました" }));
    expect((await s.getFxOrders())[0]).toMatchObject({ placed_by: "ai", ai_comment: "飛びつきました" });
  });
});
