import { madRange } from '@nekase/core';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNekase } from '@/state/nekase-provider';
import { BreakdownCard } from './breakdown-card';
import { ChartLegend } from './chart-legend';
import { DayChart } from './day-chart';
import { yen } from './geometry';

/** ホーム画面の「睡眠のリズムと資産」。二段グラフ、凡例、評価額の内訳。 */
export function ChartSection() {
  const c = useTheme();
  const { chart } = useNekase();
  const { records, settings, sim, elapsed, demo, startDate } = chart;
  const [picked, setPicked] = useState<number | null>(null);

  if (elapsed < 1) {
    return (
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: c.line }]}>
        <ThemedText type="smallBold">睡眠のリズムと資産</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {startDate
            ? `開始日(${startDate})から、グラフが始まります。`
            : '設定で開始日を決めると、グラフが始まります。(「設定」タブの「目標時刻と開始日」)'}
        </ThemedText>
      </ThemedView>
    );
  }

  const day = Math.min(picked ?? elapsed, elapsed);
  const cur = sim[day - 1];
  const m7 = madRange(records, Math.max(0, day - 7), day - 1, settings.targetBed);
  const gain = cur && cur.principal > 0 ? `${cur.value >= cur.principal ? '+' : '−'}${Math.abs((cur.value / cur.principal - 1) * 100).toFixed(1)}%` : '—';

  return (
    <View style={styles.wrap}>
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: c.line }]}>
        <View style={styles.head}>
          <ThemedText type="smallBold">睡眠のリズムと資産</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {day}日目 / 30日{demo ? ' · デモデータ' : ''}
          </ThemedText>
        </View>
        <View style={styles.stats}>
          <View style={[styles.stat, { borderColor: c.sleep }]}>
            <ThemedText type="small" themeColor="textSecondary">就寝のズレ(直近7日の平均)</ThemedText>
            <ThemedText type="subtitle" themeColor="sleepInk">
              {m7 != null ? `${Math.round(m7)}分` : '—'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">小さいほど規則的</ThemedText>
          </View>
          <View style={[styles.stat, { borderColor: c.asset }]}>
            <ThemedText type="small" themeColor="textSecondary">仮想の評価額</ThemedText>
            <ThemedText type="subtitle" style={{ color: c.assetInk }}>
              {cur ? yen(cur.value) : '—'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">元本 {cur ? yen(cur.principal) : '—'} · {gain}</ThemedText>
          </View>
        </View>

        <DayChart records={records} settings={settings} sim={sim} elapsed={elapsed} day={day} onDay={setPicked} />

        <View style={styles.stepRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="前の日" disabled={day <= 1} onPress={() => setPicked(day - 1)} style={[styles.step, { borderColor: c.sleep }, day <= 1 && styles.off]}>
            <ThemedText type="smallBold" themeColor="sleepInk">◀ 前の日</ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="次の日" disabled={day >= elapsed} onPress={() => setPicked(day + 1)} style={[styles.step, { borderColor: c.sleep }, day >= elapsed && styles.off]}>
            <ThemedText type="smallBold" themeColor="sleepInk">次の日 ▶</ThemedText>
          </Pressable>
        </View>

        <ChartLegend targetBed={settings.targetBed} targetWake={settings.targetWake} anyLoss={sim.slice(0, elapsed).some((q) => q.loss > 0)} />
        <ThemedText type="small" themeColor="textSecondary">
          グラフをなぞると、日付が動きます。睡眠時間は推定値です。
        </ThemedText>
      </ThemedView>

      <BreakdownCard cur={cur} day={day} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  card: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, borderLeftWidth: 4, paddingLeft: Spacing.two, gap: Spacing.half },
  stepRow: { flexDirection: 'row', gap: Spacing.three },
  step: { flex: 1, minHeight: 44, borderWidth: 2, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.4 },
});
