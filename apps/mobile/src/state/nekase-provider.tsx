import { pendingState, wakeRecord, type PendingState } from '@nekase/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { createStorage, type RecordRow, type Storage } from '@/storage';

interface NekaseValue {
  /** 読み込みが終わるまで false */
  ready: boolean;
  records: RecordRow[];
  pending: PendingState;
  /** 直近で「破棄した」ことを知らせるメッセージ(画面で表示して clearNotice で消す) */
  notice: string | null;
  clearNotice: () => void;
  pressBed: () => Promise<void>;
  cancelBed: () => Promise<void>;
  pressWake: () => Promise<void>;
  /** 時刻の修正。同じ起床日があれば上書き(課題のチェックは引き継ぐ) */
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
  const [bedTs, setBedTs] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [recs, ts] = await Promise.all([s.getRecords(), s.getPendingBed()]);
      setRecords(recs);
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

  const value = useMemo<NekaseValue>(
    () => ({
      ready,
      records,
      pending: pendingState(bedTs, now()),
      notice,
      clearNotice: () => setNotice(null),
      pressBed,
      cancelBed,
      pressWake,
      saveSleep,
    }),
    [ready, records, bedTs, notice, pressBed, cancelBed, pressWake, saveSleep, now],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNekase(): NekaseValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('NekaseProvider の中で使ってください');
  return v;
}
