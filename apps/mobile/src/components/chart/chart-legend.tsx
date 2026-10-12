import { clock } from '@nekase/core';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ChartDefs } from './chart-defs';

export type SwatchKind = 'bar' | 'barOff' | 'band' | 'l1' | 'l2' | 'l3' | 'loss' | 'line';

/** 凡例・内訳で使う見本。グラフと同じ模様を使い、色だけに頼らない。 */
export function Swatch({ kind }: { kind: SwatchKind }) {
  const c = useTheme();
  return (
    <Svg width={20} height={14} viewBox="0 0 20 14">
      <ChartDefs />
      {kind === 'bar' && <Rect x={7} y={0} width={6} height={14} rx={3} fill={c.sleep} />}
      {kind === 'barOff' && <Rect x={7.7} y={0.7} width={4.6} height={12.6} rx={2.3} fill={c.background} stroke={c.sleep} strokeWidth={1.4} />}
      {kind === 'band' && <Rect x={0} y={2} width={20} height={10} fill={c.backgroundSelected} />}
      {kind === 'l1' && <Rect x={0} y={0} width={20} height={14} rx={2} fill={c.assetL1} />}
      {kind === 'l2' && (
        <>
          <Rect x={0} y={0} width={20} height={14} rx={2} fill={c.assetL2} />
          <Rect x={0} y={0} width={20} height={14} rx={2} fill="url(#hatch-gain)" />
        </>
      )}
      {kind === 'l3' && (
        <>
          <Rect x={0} y={0} width={20} height={14} rx={2} fill={c.assetL3} />
          <Rect x={0} y={0} width={20} height={14} rx={2} fill="url(#hatch-comp)" />
        </>
      )}
      {kind === 'loss' && <Rect x={0} y={0} width={20} height={14} rx={2} fill="url(#hatch-loss)" stroke={c.textSecondary} strokeWidth={1} />}
      {kind === 'line' && <Line x1={0} y1={7} x2={20} y2={7} stroke={c.text} strokeWidth={2} />}
    </Svg>
  );
}

function Item({ kind, label }: { kind: SwatchKind; label: string }) {
  return (
    <View style={styles.item}>
      <Swatch kind={kind} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/** 凡例。上段(睡眠)と下段(資産)で分ける。 */
export function ChartLegend({ targetBed, targetWake, anyLoss }: { targetBed: number; targetWake: number; anyLoss: boolean }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Item kind="bar" label="就寝 → 起床" />
        <Item kind="barOff" label="就寝が帯の外(枠のみ)" />
        <Item kind="band" label={`目標の±30分(就寝 ${clock(targetBed)} / 起床 ${clock(targetWake)})`} />
      </View>
      <View style={styles.row}>
        <Item kind="l1" label="積立元本" />
        <Item kind="l2" label="運用益(斜線)" />
        <Item kind="l3" label="複利の分(格子)" />
        {anyLoss && <Item kind="loss" label="元本割れ(縦線)" />}
        <Item kind="line" label="評価額(合計)" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: Spacing.one },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
