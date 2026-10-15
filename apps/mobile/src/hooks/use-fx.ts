import { axisNow, fxState, type FxState } from '@nekase/core';
import { useEffect, useMemo, useState } from 'react';

import { useNekase } from '@/state/nekase-provider';

/** 夜間ロックが始まる瞬間に画面が切り替わるよう、30 秒ごとに時刻を読み直す。 */
const TICK_MS = 30_000;

/** チャレンジの状態。計算は core の fxState() で、ここでは材料と時刻を渡すだけ。 */
export function useFx(): FxState {
  const { fxBase, now } = useNekase();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);
  // tick が変わるたびに、now() で時刻を取り直す
  return useMemo(
    () => fxState({ ...fxBase, nowAxis: axisNow(new Date(now())) }),
    [fxBase, now, tick],
  );
}
