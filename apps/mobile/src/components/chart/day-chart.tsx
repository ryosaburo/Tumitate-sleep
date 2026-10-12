import { eqDrawdown, type DayRecord, type Settings, type SimDay } from '@nekase/core';
import { useRef, useState } from 'react';
import { type GestureResponderEvent, Platform, View, type LayoutChangeEvent } from 'react-native';
import Svg from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { AssetLayers } from './asset-layers';
import { ChartCursor } from './chart-cursor';
import { ChartDefs } from './chart-defs';
import { dayFromX, VIEW_H, W } from './geometry';
import { SleepBars } from './sleep-bars';

const DIP = eqDrawdown();

interface Props {
  records: readonly (DayRecord | null)[];
  settings: Settings;
  sim: readonly SimDay[];
  elapsed: number;
  day: number;
  onDay: (d: number) => void;
}

/**
 * 二段グラフ。上: 睡眠の棒、下: 資産の積み上げ。共通の日付軸で、カーソルを指でなぞって日を選ぶ。
 * 棒と積み上げは memo で固定し、日を選んだときはカーソルだけを描き直す。
 */
export function DayChart({ records, settings, sim, elapsed, day, onDay }: Props) {
  const c = useTheme();
  const [width, setWidth] = useState(0);
  const last = useRef(day);

  const pick = (e: GestureResponderEvent) => {
    if (width <= 0 || elapsed < 1) return;
    const d = dayFromX((e.nativeEvent.locationX / width) * W, elapsed);
    if (d !== last.current) {
      last.current = d;
      onDay(d);
    }
  };

  return (
    <View
      accessible
      accessibilityLabel={`${day}日目までの、就寝と起床の棒グラフ(上)と、仮想の評価額の内訳の推移(下)。日付は下のボタンでも選べます。`}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={pick}
      onResponderMove={pick}
      style={[
        { width: '100%', maxWidth: 560, alignSelf: 'center', aspectRatio: W / VIEW_H },
        Platform.OS === 'web' && ({ touchAction: 'pan-y', cursor: 'pointer', userSelect: 'none' } as object),
      ]}>
      <View pointerEvents="none" style={{ flex: 1 }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${VIEW_H}`}>
          <ChartDefs />
          <SleepBars records={records} elapsed={elapsed} targetBed={settings.targetBed} targetWake={settings.targetWake} c={c} />
          <AssetLayers sim={sim} elapsed={elapsed} dip={DIP} c={c} />
          {elapsed > 0 && <ChartCursor sim={sim} day={day} c={c} />}
        </Svg>
      </View>
    </View>
  );
}
