import type { SimDay } from '@nekase/core';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Swatch, type SwatchKind } from './chart-legend';
import { yen } from './geometry';

/** 評価額の内訳カード。選んだ日の時点の、積立元本・運用益・複利の分・元本割れ。 */
export function BreakdownCard({ cur, day }: { cur: SimDay | undefined; day: number }) {
  const c = useTheme();
  if (!cur) return null;
  const p = cur.principal;
  const v = cur.value;
  const total = Math.max(p, v, 1);
  const segs: [SwatchKind, number, string][] = [
    ['l1', Math.min(v, p), c.assetL1],
    ['l2', cur.g1, c.assetL2],
    ['l3', cur.comp, c.assetL3],
    ['loss', cur.loss, c.textSecondary],
  ];

  let note: string;
  const rows: { kind: SwatchKind; name: string; sub: string; amt: string }[] = [];
  if (p === 0) {
    note = '積立が始まると、ここに内訳が出ます。';
  } else {
    rows.push({ kind: 'l1', name: '積立元本', sub: '自分で積み立てた仮想のお金', amt: yen(p) });
    if (cur.G > 0) {
      rows.push({ kind: 'l2', name: '運用益', sub: '積立元本が生んだ分', amt: `+${yen(cur.g1)}` });
      rows.push({ kind: 'l3', name: '複利の分', sub: '運用益がさらに運用されて生んだ分', amt: `+${yen(cur.comp)}` });
      note =
        `運用益のうち ${Math.round((cur.comp / cur.G) * 100)}% が、増えた分がさらに運用されて生んだ複利の分です。` +
        (cur.comp / Math.max(v, 1) < 0.01 ? '期間が短いため、まだ小さな値です。長く続けるほど大きくなります。' : '');
    } else if (cur.loss > 0) {
      rows.push({ kind: 'loss', name: '元本割れ', sub: '値下がりで、一時的に下回っている分', amt: `−${yen(cur.loss)}` });
      note = '値下がりで元本を下回る時期は、積立を続けている間にも起こります。';
    } else {
      note = '運用益は、まだありません。';
    }
  }

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: c.line }]}>
      <View style={styles.head}>
        <ThemedText type="smallBold">評価額の内訳</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {day}日目の時点
        </ThemedText>
      </View>
      <View accessibilityRole="image" accessibilityLabel="評価額の内訳の割合" style={[styles.bar, { backgroundColor: c.background }]}>
        {segs.map(([k, amt, color]) =>
          amt > 0 ? <View key={k} style={{ width: `${(amt / total) * 100}%`, backgroundColor: color, borderRightWidth: 1, borderRightColor: c.backgroundElement }} /> : null,
        )}
      </View>
      {rows.map((r) => (
        <View key={r.kind} style={styles.row}>
          <Swatch kind={r.kind} />
          <View style={styles.grow}>
            <ThemedText type="small">{r.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {r.sub}
            </ThemedText>
          </View>
          <ThemedText type="smallBold">{r.amt}</ThemedText>
        </View>
      ))}
      {p > 0 && (
        <View style={[styles.row, styles.total, { borderTopColor: c.line }]}>
          <View style={styles.grow}>
            <ThemedText type="smallBold">評価額</ThemedText>
          </View>
          <ThemedText type="smallBold" style={{ color: c.assetInk }}>
            {yen(v)}
          </ThemedText>
        </View>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {note}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bar: { height: 14, borderRadius: 7, overflow: 'hidden', flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  grow: { flex: 1 },
  total: { borderTopWidth: 1, paddingTop: Spacing.two },
});
