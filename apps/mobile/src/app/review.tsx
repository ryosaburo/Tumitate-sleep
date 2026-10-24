import {
  DAYS,
  DEMO_RECORDS,
  DEMO_SETTINGS,
  WEEK_GOAL,
  madRange,
  monthSummary,
  reveal,
  simulate,
  weeklySummary,
} from '@nekase/core';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { yen } from '@/components/chart/geometry';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, WebTopInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNekase } from '@/state/nekase-provider';

const NOTE = '学習用のシミュレーションです。実際の売買や換金はできません。睡眠時間は推定値です。';
/** 色に頼らず、符号で示す。 */
const pct = (r: number) => `${r >= 0 ? '＋' : '−'}${(Math.abs(r) * 100).toFixed(1)}%`;
const mins = (m: number | null) => (m === null ? '—' : `約 ${Math.round(m)} 分`);
const DEMO_SIM = simulate(DEMO_RECORDS, DEMO_SETTINGS);
const DEMO_SUMMARY = monthSummary(DEMO_RECORDS, DEMO_SIM, DEMO_SETTINGS.targetBed, DAYS)!;
const DEMO_WEEKS = weeklySummary(DEMO_RECORDS, DEMO_SIM, DEMO_SETTINGS.targetBed, DAYS);
const DEMO_REVEAL = reveal(DEMO_SIM, DEMO_SETTINGS.preset);
const DEMO_FIRST = madRange(DEMO_RECORDS, 0, 6, DEMO_SETTINGS.targetBed);
const DEMO_RECENT = madRange(DEMO_RECORDS, DAYS - 7, DAYS - 1, DEMO_SETTINGS.targetBed);
const DEMO_LAST = DEMO_SIM[DAYS - 1]!;

export default function ReviewScreen() {
  const theme = useTheme();
  const { ready, chart, setDemo } = useNekase();
  const { sim, records, settings, elapsed, demo } = chart;
  const [showExplanation, setShowExplanation] = useState(false);

  const summary = monthSummary(records, sim, settings.targetBed, elapsed);
  const weeks = elapsed > 0 ? weeklySummary(records, sim, settings.targetBed, elapsed) : [];
  const done = elapsed >= DAYS;
  const rv = done ? reveal(sim, settings.preset) : null;
  const first = madRange(records, 0, 6, settings.targetBed);
  const recent = madRange(records, DAYS - 7, DAYS - 1, settings.targetBed);
  const last = sim[DAYS - 1];

  const card = [styles.card, { borderColor: theme.line }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.heading}>
            <ThemedText type="subtitle">振り返り</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showExplanation }}
              onPress={() => setShowExplanation(!showExplanation)}
              style={styles.explanationButton}>
              <ThemedText type="small" themeColor="sleepInk" style={styles.underline}>
                (振り返りの説明)
              </ThemedText>
            </Pressable>
          </View>
          {showExplanation && (
            <ThemedView type="backgroundElement" style={[styles.explanation, { borderColor: theme.line }]}>
              <View style={styles.guideSection}>
                <ThemedText type="smallBold">1. 週ごとの振り返り</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  1週間ごとに、行動課題をクリアした日数、就寝時刻のズレの平均、週末時点の仮想資産を確認できます。週5日クリアすると、その週は達成です。就寝時刻のズレは記録が3日分以上ある週に表示します。
                </ThemedText>
                {DEMO_WEEKS.map((w) => (
                  <ThemedView key={w.index} type="background" style={[styles.demoCard, { borderColor: theme.line }]}>
                    <View style={styles.head}>
                      <ThemedText type="smallBold">
                        デモ: 第 {w.index + 1} 週({w.from + 1}〜{w.to + 1}日目)
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {w.achieved ? '達成 ✓' : `${WEEK_GOAL} 日クリアで達成`}
                      </ThemedText>
                    </View>
                    <View style={styles.dots} accessibilityLabel={`デモのクリア ${w.clearDays} 日`}>
                      {Array.from({ length: 7 }, (_, i) => {
                        const day = w.from + i;
                        const inRange = day <= w.to;
                        const clear = inRange && DEMO_SIM[day]!.stat.clear;
                        return (
                          <View
                            key={i}
                            style={[
                              styles.dot,
                              { borderColor: inRange ? theme.sleep : theme.line },
                              clear && { backgroundColor: theme.sleep },
                            ]}>
                            <ThemedText type="small" style={{ color: clear ? theme.onSleep : theme.textSecondary }}>
                              {clear ? '✓' : inRange ? '' : '・'}
                            </ThemedText>
                          </View>
                        );
                      })}
                      <ThemedText type="small">{w.clearDays} / 7 日</ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      就寝のズレの平均: {w.mad === null ? '記録が 3 日分以上あると表示します' : mins(w.mad)}
                    </ThemedText>
                    <ThemedText type="small">週末の評価額: {yen(w.endValue)}</ThemedText>
                  </ThemedView>
                ))}
                <ThemedText type="small" themeColor="textSecondary">
                  以下は既存のサンプル30日分から作った表示例です。あなたの記録や資産には反映されません。
                </ThemedText>
              </View>

              <View style={styles.guideSection}>
                <ThemedText type="smallBold">2. 30日目の答え合わせ</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  30日分の記録がそろうと、初週と最後の7日の就寝時刻のズレ、積立元本と評価額、仮想の値下がり期間に積立を続けた場合の結果を振り返れます。
                </ThemedText>
                <ThemedView type="background" style={[styles.demoCard, { borderColor: theme.line }]}>
                  <ThemedText type="smallBold">デモ: 30日間のまとめ</ThemedText>
                  {DEMO_SUMMARY.lines.map((line) => (
                    <ThemedText key={line} type="small">{line}</ThemedText>
                  ))}
                  <ThemedText type="small" themeColor="textSecondary">
                    記録 {DEMO_SUMMARY.recorded} / {DEMO_SUMMARY.days} 日 ・ クリア {DEMO_SUMMARY.clearDays} 日 ・
                    達成した週 {DEMO_SUMMARY.achievedWeeks} / {DEMO_SUMMARY.weekCount} ・ 積立元本 {yen(DEMO_SUMMARY.principal)} → 評価額 {yen(DEMO_SUMMARY.value)}
                  </ThemedText>
                  <View style={[styles.demoSubsection, { borderTopColor: theme.line }]}>
                    <ThemedText type="smallBold">就寝のズレ</ThemedText>
                    <ThemedText type="small">初週: {mins(DEMO_FIRST)}</ThemedText>
                    <ThemedText type="small">直近 7 日: {mins(DEMO_RECENT)}</ThemedText>
                  </View>
                  <View style={[styles.demoSubsection, { borderTopColor: theme.line }]}>
                    <ThemedText type="smallBold">資産</ThemedText>
                    <ThemedText type="small">
                      積立元本 {yen(DEMO_LAST.principal)} → 評価額 {yen(DEMO_LAST.value)}
                    </ThemedText>
                    <ThemedText type="small">複利の分: {yen(DEMO_LAST.comp)}</ThemedText>
                  </View>
                  <View style={[styles.demoSubsection, { borderTopColor: theme.line }]}>
                    <ThemedText type="smallBold">値下がりの最中も続けた結果</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      世界株式は、{DEMO_REVEAL.peakDay}〜{DEMO_REVEAL.troughDay} 日目に最大 {pct(DEMO_REVEAL.maxDD)} 下がりました。
                    </ThemedText>
                    {DEMO_REVEAL.groups.map((g) => (
                      <View key={g.n} style={styles.row}>
                        <View style={styles.grow}>
                          <ThemedText type="small">{g.n}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {g.a}〜{g.b} 日目 / 積立 {g.days} 日・{yen(g.cost)}
                          </ThemedText>
                        </View>
                        <ThemedText type="smallBold">{g.ret === null ? '積立なし' : pct(g.ret)}</ThemedText>
                      </View>
                    ))}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    結果を知ってから分かることで、同じ展開になる保証はありません。値動きは仮想データです。
                  </ThemedText>
                </ThemedView>
              </View>
            </ThemedView>
          )}
          {!ready ? null : elapsed === 0 ? (
            <ThemedView type="backgroundElement" style={card}>
              <ThemedText type="small" themeColor="textSecondary">
                まだ記録がありません。設定で 30 日の開始日を決めて、「ねる」「おきた」を押すと、ここに週ごとの振り返りが出ます。
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" onPress={() => setDemo(true)}>
                見本を見る(デモデータ)
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              {demo && (
                <ThemedText type="small" themeColor="textSecondary">
                  デモデータを表示中です(保存されません)。
                </ThemedText>
              )}

              {summary && (
                <ThemedView type="backgroundElement" style={card}>
                  <ThemedText type="smallBold">{summary.days >= DAYS ? 'この30日のまとめ' : `ここまで ${summary.days} 日のまとめ`}</ThemedText>
                  {summary.lines.map((line) => (
                    <ThemedText key={line} type="small">
                      {line}
                    </ThemedText>
                  ))}
                  <ThemedText type="small" themeColor="textSecondary">
                    記録 {summary.recorded} / {summary.days} 日 ・ クリア {summary.clearDays} 日 ・ 達成した週 {summary.achievedWeeks} / {summary.weekCount} ・
                    積立元本 {yen(summary.principal)} → 評価額 {yen(summary.value)}
                  </ThemedText>
                </ThemedView>
              )}

              <ThemedText type="smallBold">週ごとの振り返り</ThemedText>
              {weeks.map((w) => (
                <ThemedView key={w.index} type="backgroundElement" style={card}>
                  <View style={styles.head}>
                    <ThemedText type="smallBold">
                      第 {w.index + 1} 週({w.from + 1}〜{w.to + 1}日目)
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {w.achieved ? '達成 ✓' : `${WEEK_GOAL} 日クリアで達成`}
                    </ThemedText>
                  </View>
                  <View style={styles.dots} accessibilityLabel={`クリア ${w.clearDays} 日`}>
                    {Array.from({ length: 7 }, (_, i) => {
                      const day = w.from + i;
                      const inRange = day <= w.to;
                      const clear = inRange && sim[day]!.stat.clear;
                      return (
                        <View
                          key={i}
                          style={[
                            styles.dot,
                            { borderColor: inRange ? theme.sleep : theme.line },
                            clear && { backgroundColor: theme.sleep },
                          ]}>
                          <ThemedText type="small" style={{ color: clear ? theme.onSleep : theme.textSecondary }}>
                            {clear ? '✓' : inRange ? '' : '・'}
                          </ThemedText>
                        </View>
                      );
                    })}
                    <ThemedText type="small">{w.clearDays} / 7 日</ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    就寝のズレの平均: {w.mad === null ? '記録が 3 日分以上あると表示します' : mins(w.mad)}
                  </ThemedText>
                  <ThemedText type="small">週末の評価額: {yen(w.endValue)}</ThemedText>
                </ThemedView>
              ))}

              <ThemedText type="smallBold">30 日目の答え合わせ</ThemedText>
              {!done || !rv || !last ? (
                <ThemedView type="backgroundElement" style={card}>
                  <ThemedText type="small" themeColor="textSecondary">
                    30 日目になると、ここに答え合わせが出ます(いま {elapsed} 日目)。
                  </ThemedText>
                </ThemedView>
              ) : (
                <>
                  <ThemedView type="backgroundElement" style={card}>
                    <ThemedText type="smallBold">就寝のズレ</ThemedText>
                    <ThemedText type="small">初週: {mins(first)}</ThemedText>
                    <ThemedText type="small">直近 7 日: {mins(recent)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      目標の就寝時刻との差の平均です。記録が 3 日分未満の期間は「—」です。
                    </ThemedText>
                  </ThemedView>

                  <ThemedView type="backgroundElement" style={card}>
                    <ThemedText type="smallBold">資産</ThemedText>
                    <ThemedText type="small">
                      積立元本 {yen(last.principal)} → 評価額 {yen(last.value)}
                    </ThemedText>
                    <ThemedText type="small">複利の分: {yen(last.comp)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      期間が短いため、複利の分はまだ小さな値です。
                    </ThemedText>
                  </ThemedView>

                  <ThemedView type="backgroundElement" style={card}>
                    <ThemedText type="smallBold">値下がりの最中も続けた結果</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      世界株式は、{rv.peakDay}〜{rv.troughDay} 日目に最大 {pct(rv.maxDD)} 下がりました。積立した時期ごとの増減です。
                    </ThemedText>
                    {rv.groups.map((g) => (
                      <View key={g.n} style={[styles.row, { borderTopColor: theme.line }]}>
                        <View style={styles.grow}>
                          <ThemedText type="small">{g.n}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {g.a}〜{g.b} 日目 / 積立 {g.days} 日・{yen(g.cost)}
                          </ThemedText>
                        </View>
                        <ThemedText type="smallBold">{g.ret === null ? '積立なし' : pct(g.ret)}</ThemedText>
                      </View>
                    ))}
                  </ThemedView>

                  <ThemedText type="small" themeColor="textSecondary">
                    結果を知ってから分かることで、同じ展開になる保証はありません。ここでの値動きは仮想データです。
                  </ThemedText>
                </>
              )}

              <Link href="/challenge" style={{ color: theme.sleepInk }}>
                <ThemedText type="linkPrimary">取引ログを見る(チャレンジ)</ThemedText>
              </Link>
            </>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {NOTE}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  scroll: { padding: Spacing.four, paddingTop: Spacing.four + WebTopInset, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  explanationButton: { minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  explanation: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.three },
  guideSection: { gap: Spacing.one },
  demoCard: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.two },
  card: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderTopWidth: 1, paddingTop: Spacing.two },
  demoSubsection: { borderTopWidth: 1, paddingTop: Spacing.two, gap: Spacing.one },
  grow: { flex: 1 },
});
