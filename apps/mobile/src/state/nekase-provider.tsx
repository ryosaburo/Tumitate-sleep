import {
  DEMO_RECORDS,
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

import { toDayRecord, toSettings } from './convert';
import { createStorage, defaultSettings, type RecordRow, type SettingsRow, type Storage } from '@/storage';

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

interface NekaseValue {
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
}

const Ctx = createContext<NekaseValue | null>(null);

/** アプリで 1 つの Storage を持ち、記録と「ねる」の途中状態を画面に渡す。時刻は now() で差し込める(テスト用)。 */
export function NekaseProvider({ children, now = Date.now }: { children: ReactNode; now?: () => number }) {
  const storage = useRef<Storage | null>(null);
  if (storage.current === null) storage.current = createStorage();
  const s = storage.current;

  const [ready, setReady] = useState(false);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [settingsRow, setSettingsRow] = useState<SettingsRow>(() => defaultSettings(0));
  const settings = useMemo<Settings>(() => toSettings(settingsRow), [settingsRow]);
  const [demo, setDemo] = useState(false);
  const [bedTs, setBedTs] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [recs, ts, st] = await Promise.all([s.getRecords(), s.getPendingBed(), s.getSettings()]);
      setRecords(recs);
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
    })();
  }, [s, now]);

  const pressBed = useCallback(async () => {
    const t = now();
    await s.setPendingBed(t, t);
    setBedTs(t);
    setNotice(null);
  }, [s, now]);

  const cancelBed = useCallback(async () => {
    await s.setPendingBed(null, now());
    setBedTs(null);
  }, [s, now]);

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
  }, [s, now, bedTs]);

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
    },
    [s, now],
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
    },
    [s, now],
  );

  const saveSettings = useCallback<NekaseValue['saveSettings']>(
    async (patch) => {
      const t = now();
      // 「ねる」の途中状態は保存側が持っているので、最新の行に重ねる
      const cur = (await s.getSettings()) ?? defaultSettings(t);
      const next = { ...cur, ...patch, updated_at: t };
      await s.putSettings(next);
      setSettingsRow(next);
    },
    [s, now],
  );

  const resetAll = useCallback(async () => {
    await s.clear();
    setRecords([]);
    setBedTs(null);
    setSettingsRow(defaultSettings(now()));
    setNotice(null);
  }, [s, now]);

  const todayKey = dateKey(new Date(now()));
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
    }),
    [ready, records, settings, settingsRow, chart, saveSettings, resetAll, toggleSelf, bedTs, notice, pressBed, cancelBed, pressWake, saveSleep, now],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNekase(): NekaseValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('NekaseProvider の中で使ってください');
  return v;
}
