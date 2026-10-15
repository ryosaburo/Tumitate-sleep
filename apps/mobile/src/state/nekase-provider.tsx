import {
  DEMO_RECORDS,
  axisNow,
  fxState,
  validateOrder,
  type FxInput,
  type FxOrder,
  type FxOrderInput,
  type FxReason,
  type OrderError,
  DEMO_SETTINGS,
  dateKey,
  elapsedDays,
  pendingState,
  simRecords,
  simulate,
  wakeRecord,
  type DayRecord,
  type PendingState,
  type Settings,
  type SimDay,
  type TaskKey,
} from '@nekase/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { toDayRecord, toSettings } from './convert';
import { createStorage, defaultSettings, type FxOrderRow, type RecordRow, type SettingsRow, type Storage } from '@/storage';
import { createHttpApi, createSessionStore, createSyncEngine, type Credentials, type LinkCode, type LinkMode, type SyncEngine } from '@/sync';

/** 連続した操作を、1 回の同期にまとめる待ち時間 */
const SYNC_DELAY_MS = 1500;
/** 同期に失敗したあと、もう一度ためすまでの時間 */
const RETRY_MS = 30_000;

/** 同期の状態。画面には「同期済み / 未同期」を出すだけで、エラーで操作を止めない。 */
export interface SyncStatus {
  state: 'idle' | 'syncing' | 'ok' | 'offline' | 'error';
  /** 最後に同期できた時刻(ミリ秒)。まだなければ null */
  lastSyncedAt: number | null;
}

/** グラフ用の 30 日分のデータ。デモ表示のときは、デモの記録と設定を使う。 */
export interface ChartData {
  demo: boolean;
  settings: Settings;
  /** 1 日目から 30 日分。記録がない日は null */
  records: (DayRecord | null)[];
  /** 経過日数(0〜30)。0 は、まだ始まっていない */
  elapsed: number;
  /** 30 日分の計算結果(経過日より先は、記録なしとして計算した値) */
  sim: SimDay[];
  startDate: string | null;
}

/** チャレンジ画面が fxState() に渡す材料(現在時刻の分だけは、画面が刻々と渡す)。 */
export type FxBase = Omit<FxInput, 'nowAxis'>;

interface NekaseValue {
  /** FX チャレンジの材料。デモ表示の影響を受けず、実際の記録と設定を使う */
  fxBase: FxBase;
  /** 現在時刻(ミリ秒) */
  now: () => number;
  /** 注文する。問題があればエラーの一覧を返し、保存しない。確認ステップを済ませたら confirmed を true で渡す */
  placeFxOrder: (order: FxOrderInput, opts: { confirmed: boolean; reason: FxReason | null }) => Promise<OrderError[]>;
  /** 読み込みが終わるまで false */
  ready: boolean;
  records: RecordRow[];
  settings: Settings;
  chart: ChartData;
  /** デモデータの表示(保存しない。再読み込みで戻る) */
  setDemo: (on: boolean) => void;
  /** 保存用の設定(目標時刻の文字列、開始日など) */
  settingsRow: SettingsRow;
  /** 今日の起床日 'YYYY-MM-DD' */
  today: string;
  pending: PendingState;
  /** 直近で「破棄した」ことを知らせるメッセージ(画面で表示して clearNotice で消す) */
  notice: string | null;
  clearNotice: () => void;
  pressBed: () => Promise<void>;
  cancelBed: () => Promise<void>;
  pressWake: () => Promise<void>;
  /** 時刻の修正。同じ起床日があれば上書き(課題のチェックは引き継ぐ) */
  /** 自己申告の課題(screen / caffeine)のチェックを切り替える。今日の記録がなければ作る */
  toggleSelf: (task: Extract<TaskKey, 'screen' | 'caffeine'>) => Promise<void>;
  /** 設定の一部を保存する。「ねる」の途中状態は変えない */
  saveSettings: (patch: Partial<Pick<SettingsRow, 'target_bed' | 'target_wake' | 'start_date' | 'tasks_json' | 'preset'>>) => Promise<void>;
  /** 端末内の全データを消す */
  resetAll: () => Promise<void>;
  saveSleep: (date: string, bed: number, wake: number) => Promise<void>;
  syncStatus: SyncStatus;
  /** 引き継ぎコードを発行する(1 台目)。失敗は ApiFailure を投げる */
  startLink: () => Promise<LinkCode>;
  /** コードを確かめて、認証情報を受け取る(2 台目)。端末にはまだ反映しない。失敗は ApiFailure を投げる */
  redeemLink: (code: string) => Promise<Credentials>;
  /** 受け取った認証情報を反映する。overwrite: 端末内を消して取り込む / merge: 両方を残す */
  applyLink: (creds: Credentials, mode: LinkMode) => Promise<void>;
}

const Ctx = createContext<NekaseValue | null>(null);

/** アプリで 1 つの Storage を持ち、記録と「ねる」の途中状態を画面に渡す。時刻は now() で差し込める(テスト用)。 */
export function NekaseProvider({ children, now = Date.now }: { children: ReactNode; now?: () => number }) {
  const storage = useRef<Storage | null>(null);
  if (storage.current === null) storage.current = createStorage();
  const s = storage.current;

  const [ready, setReady] = useState(false);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [fxRows, setFxRows] = useState<FxOrderRow[]>([]);
  const [settingsRow, setSettingsRow] = useState<SettingsRow>(() => defaultSettings(0));
  const settings = useMemo<Settings>(() => toSettings(settingsRow), [settingsRow]);
  const [demo, setDemo] = useState(false);
  const [bedTs, setBedTs] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle', lastSyncedAt: null });

  // 同期。他の端末の変更を取り込んだら、画面の状態を読み直す
  const reloadRef = useRef<() => Promise<void>>(async () => {});
  const engine = useRef<SyncEngine | null>(null);
  if (engine.current === null) {
    engine.current = createSyncEngine({
      storage: s,
      api: createHttpApi(process.env.EXPO_PUBLIC_API_URL ?? ''),
      sessions: createSessionStore(),
      now,
      onApplied: () => void reloadRef.current(),
    });
  }
  const eng = engine.current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncNow = useCallback(async () => {
    setSyncStatus((p) => ({ ...p, state: 'syncing' }));
    const r = await eng.sync();
    if (r.ok) {
      setSyncStatus({ state: 'ok', lastSyncedAt: now() });
    } else {
      setSyncStatus((p) => ({ ...p, state: r.reason === 'network' ? 'offline' : 'error' }));
      // 通信できなかったときだけ、あとで自動的にもう一度ためす
      if (r.reason === 'network') {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void syncNow(), RETRY_MS);
      }
    }
  }, [eng, now]);

  /** 記録や設定を変えたあとに呼ぶ。少し待って、まとめて 1 回同期する */
  const scheduleSync = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void syncNow(), SYNC_DELAY_MS);
  }, [syncNow]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    (async () => {
      const [recs, ts, st, fx] = await Promise.all([s.getRecords(), s.getPendingBed(), s.getSettings(), s.getFxOrders()]);
      setRecords(recs);
      setFxRows(fx);
      if (st) setSettingsRow(st);
      // 18 時間以上たった「ねる」は破棄して、時刻入力を促す
      if (ts !== null && pendingState(ts, now()).kind === 'stale') {
        await s.setPendingBed(null, now());
        setNotice('「ねる」を押してから18時間以上たったので、取り消しました。「時刻の修正」から入力してください。');
        setBedTs(null);
      } else {
        setBedTs(ts);
      }
      setReady(true);
      void syncNow(); // アプリを開いたとき
    })();
  }, [s, now, syncNow]);

  // アプリに戻ってきたときも同期する
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && ready) void syncNow();
    });
    return () => sub.remove();
  }, [ready, syncNow]);

  // 他の端末の変更を取り込んだあと、端末内の保存から読み直す
  reloadRef.current = async () => {
    const [recs, ts, st, fx] = await Promise.all([s.getRecords(), s.getPendingBed(), s.getSettings(), s.getFxOrders()]);
    setRecords(recs);
    setFxRows(fx);
    setSettingsRow(st ?? defaultSettings(now()));
    setBedTs(ts !== null && pendingState(ts, now()).kind === 'stale' ? null : ts);
  };

  const pressBed = useCallback(async () => {
    const t = now();
    await s.setPendingBed(t, t);
    setBedTs(t);
    setNotice(null);
    scheduleSync();
  }, [s, now, scheduleSync]);

  const cancelBed = useCallback(async () => {
    await s.setPendingBed(null, now());
    setBedTs(null);
    scheduleSync();
  }, [s, now, scheduleSync]);

  const pressWake = useCallback(async () => {
    const t = now();
    const state = pendingState(bedTs, t);
    if (state.kind === 'stale') {
      await s.setPendingBed(null, t);
      setBedTs(null);
      setNotice('「ねる」を押してから18時間以上たったので、取り消しました。「時刻の修正」から入力してください。');
      return;
    }
    if (state.kind !== 'sleeping') return;
    const w = wakeRecord(state.bedTs, t);
    // 同じ起床日の記録があれば、課題のチェックを引き継ぐ
    const old = await s.getRecord(w.date);
    const row: RecordRow = {
      date: w.date,
      bed_min: w.bed,
      wake_min: w.wake,
      screen: old?.screen ?? 0,
      caffeine: old?.caffeine ?? 0,
      updated_at: t,
    };
    await s.putRecord(row);
    await s.setPendingBed(null, t);
    setRecords(await s.getRecords());
    setBedTs(null);
    scheduleSync();
  }, [s, now, bedTs, scheduleSync]);

  const saveSleep = useCallback(
    async (date: string, bed: number, wake: number) => {
      const old = await s.getRecord(date);
      await s.putRecord({
        date,
        bed_min: bed,
        wake_min: wake,
        screen: old?.screen ?? 0,
        caffeine: old?.caffeine ?? 0,
        updated_at: now(),
      });
      setRecords(await s.getRecords());
      scheduleSync();
    },
    [s, now, scheduleSync],
  );

  const toggleSelf = useCallback(
    async (task: 'screen' | 'caffeine') => {
      const t = now();
      const date = dateKey(new Date(t));
      const old = await s.getRecord(date);
      await s.putRecord({
        date,
        bed_min: old?.bed_min ?? null,
        wake_min: old?.wake_min ?? null,
        screen: old?.screen ?? 0,
        caffeine: old?.caffeine ?? 0,
        [task]: old?.[task] === 1 ? 0 : 1,
        updated_at: t,
      });
      setRecords(await s.getRecords());
      scheduleSync();
    },
    [s, now, scheduleSync],
  );

  const saveSettings = useCallback<NekaseValue['saveSettings']>(
    async (patch) => {
      const t = now();
      // 「ねる」の途中状態は保存側が持っているので、最新の行に重ねる
      const cur = (await s.getSettings()) ?? defaultSettings(t);
      const next = { ...cur, ...patch, updated_at: t };
      await s.putSettings(next);
      setSettingsRow(next);
      scheduleSync();
    },
    [s, now, scheduleSync],
  );

  const resetAll = useCallback(async () => {
    // 端末内を消すだけだと、次の同期でサーバーから戻ってくる。この端末を引き継ぎから外して、新しく始める
    if (timer.current) clearTimeout(timer.current);
    await eng.detach();
    await s.clear();
    setSyncStatus({ state: 'idle', lastSyncedAt: null });
    setRecords([]);
    setFxRows([]);
    setBedTs(null);
    setSettingsRow(defaultSettings(now()));
    setNotice(null);
  }, [s, now, eng]);

  const startLink = useCallback(() => eng.startLink(), [eng]);
  const redeemLink = useCallback((code: string) => eng.redeemLink(code), [eng]);
  const applyLink = useCallback(
    async (creds: Credentials, mode: LinkMode) => {
      await eng.applyLink(creds, mode);
      await reloadRef.current();
      await syncNow();
    },
    [eng, syncNow],
  );

  const todayKey = dateKey(new Date(now()));
  const fxBase = useMemo<FxBase>(() => {
    const rows = records.map((r) => ({ date: r.date, ...toDayRecord(r)! }));
    const orders: FxOrder[] = fxRows.map((r) => ({
      date: r.date,
      pair: r.pair,
      side: r.side,
      amount: r.notional,
      entryRate: r.entry_rate,
      stopPct: r.stop_pct as FxOrder['stopPct'],
      gauge: r.gauge,
      confirmReason: r.reason as FxReason | null,
    }));
    return { startDate: settingsRow.start_date, today: todayKey, records: simRecords(rows, settingsRow.start_date), settings, orders };
  }, [records, fxRows, settings, settingsRow.start_date, todayKey]);

  const placeFxOrder = useCallback<NekaseValue['placeFxOrder']>(
    async (order, opts) => {
      const t = now();
      const st = fxState({ ...fxBase, today: dateKey(new Date(t)), nowAxis: axisNow(new Date(t)) });
      const errors = validateOrder(order, {
        fund: st.fund,
        gauge: st.gauge,
        nowAxis: axisNow(new Date(t)),
        targetBed: fxBase.settings.targetBed,
        targetWake: fxBase.settings.targetWake,
        orderedToday: st.orderedToday,
        confirmed: opts.confirmed,
      });
      if (st.phase !== 'active' || st.rate === null) errors.push('no_rate');
      if (errors.length > 0) return errors;
      const row: FxOrderRow = {
        date: dateKey(new Date(t)),
        pair: 'USD/JPY',
        side: order.side,
        notional: order.amount,
        entry_rate: st.rate!,
        stop_pct: order.stopPct,
        gauge: st.gauge,
        reason: st.needsConfirm ? opts.reason : null,
        updated_at: t,
      };
      await s.putFxOrder(row);
      setFxRows((p) => [...p.filter((x) => x.date !== row.date), row]);
      return [];
    },
    [fxBase, now, s],
  );
  const chart = useMemo<ChartData>(() => {
    if (demo) {
      return {
        demo,
        settings: DEMO_SETTINGS,
        records: DEMO_RECORDS,
        elapsed: 30,
        sim: simulate(DEMO_RECORDS, DEMO_SETTINGS),
        startDate: null,
      };
    }
    const rows = records.map((r) => ({ date: r.date, ...toDayRecord(r)! }));
    const recs = simRecords(rows, settingsRow.start_date);
    return {
      demo,
      settings,
      records: recs,
      elapsed: elapsedDays(settingsRow.start_date, todayKey),
      sim: simulate(recs, settings),
      startDate: settingsRow.start_date,
    };
  }, [demo, records, settings, settingsRow.start_date, todayKey]);

  const value = useMemo<NekaseValue>(
    () => ({
      fxBase,
      now,
      placeFxOrder,
      ready,
      records,
      settings,
      chart,
      setDemo,
      settingsRow,
      today: dateKey(new Date(now())),
      pending: pendingState(bedTs, now()),
      notice,
      clearNotice: () => setNotice(null),
      pressBed,
      cancelBed,
      pressWake,
      toggleSelf,
      saveSettings,
      resetAll,
      saveSleep,
      syncStatus,
      startLink,
      redeemLink,
      applyLink,
    }),
    [fxBase, placeFxOrder, ready, records, settings, settingsRow, chart, saveSettings, resetAll, toggleSelf, bedTs, notice, pressBed, cancelBed, pressWake, saveSleep, now, syncStatus, startLink, redeemLink, applyLink],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNekase(): NekaseValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('NekaseProvider の中で使ってください');
  return v;
}
