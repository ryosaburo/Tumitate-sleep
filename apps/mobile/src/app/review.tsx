import { DAYS, WEEK_GOAL, madRange, monthSummary, reveal, weeklySummary } from '@nekase/core';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { yen } from '@/components/chart/geometry';
import { ReviewGuide } from '@/components/review-guide';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, WebTopInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNekase } from '@/state/nekase-provider';

const NOTE = '学習用のシミュレーションです。実際の売買や換金はできません。睡眠時間は推定値です。';
/** 色に頼らず、符号で示す。 */
const pct = (r: number) => `${r >= 0 ? '＋' : '−'}${(Math.abs(r) * 100).toFixed(1)}%`;
const mins = (m: number | null) => (m === null ? '—' : `約 ${Math.round(m)} 分`);

const USAGE_GUIDE = [
  {
    heading: '振り返り画面とは？',
    paragraphs: [
      'この画面では、30日間の睡眠習慣と、積立投資の結果を振り返ることができます。',
      '確認できるのは、主に次の3つです。',
      '・睡眠習慣：何日クリアできたか、目標の就寝時刻に近づけたか\n・積立投資：どれくらい積み立てて、資産がどう変化したか\n・30日間の結果：続けたことで、どんな変化があったか',
      '※ 30日間は、記録した日数ではなく、チャレンジ開始日から数えます。',
    ],
  },
];

const WEEKLY_GUIDE = [
  {
    heading: '週ごとの振り返りとは？',
    paragraphs: [
      '1週間に何日クリアできたかを確認できます。',
      '7日間のうち5日以上クリアすると、その週は達成です。',
      '丸の意味は次のとおりです。',
      '・✓：その日の目標をクリア\n・○：クリアできなかった日、または記録がない日\n・・：まだ集計していない日',
      '「就寝のズレ」は、目標の就寝時刻から平均何分ずれていたかを表しています。',
      '例えば、目標が23:30の場合、23:10でも23:50でも「20分のズレ」です。',
      '※ 週は月曜日からではなく、チャレンジ開始日から7日ずつ数えます。',
    ],
  },
];

const ASSET_GUIDE = [
  { heading: '資産について', paragraphs: [] },
  {
    heading: '積立元本とは？',
    paragraphs: [
      'これまでの睡眠習慣の達成によって、積み立てた仮想のお金の合計です。',
      '例えば、1日に3,000円ずつ10日間積み立てると、元本は30,000円になります。',
    ],
  },
  {
    heading: '評価額とは？',
    paragraphs: [
      '積み立てたお金が、値動きによって今いくらになっているかを表します。',
      '例えば、',
      '・積立元本：30,000円\n・評価額：31,000円',
      'なら、1,000円の利益が出ている状態です。',
      '反対に、評価額が29,000円なら1,000円の損失です。',
    ],
  },
  {
    heading: '複利の分とは？',
    paragraphs: [
      '運用によって増えたり減ったりしたお金にも、その後の値動きが影響することを「複利」といいます。',
      '例えば、増えた利益にも次の値動きが影響することで、資産がさらに増える場合があります。',
      '※ 「複利の分」は評価額に含まれており、別にもらえるお金ではありません。',
    ],
  },
];

const DRAWDOWN_GUIDE = [
  {
    heading: '何を比べているの？',
    paragraphs: [
      '30日間の中で、いつ積み立てたお金が、最後にどうなったのかを比べています。',
      '積み立てた時期を、次の3つに分けます。',
      '・下落の前：大きく値下がりする前に積み立てたお金\n・下落の最中：値下がりしている間に積み立てたお金\n・回復のあと：値下がりが一番大きかった日より後に積み立てたお金',
      'それぞれのお金を30日目まで持っていた場合の結果を表示しています。',
      '※ 架空の相場によるシミュレーションで、実際の投資でも同じ結果になるとは限りません。',
    ],
  },
];

export default function ReviewScreen() {
  const theme = useTheme();
  const { ready, chart, setDemo } = useNekase();
  const { sim, records, settings, elapsed, demo } = chart;

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
          <ReviewGuide title="振り返り" titleType="subtitle" openLabel="使い方を見る" sections={USAGE_GUIDE} />
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

              <ReviewGuide title="週ごとの振り返り" sections={WEEKLY_GUIDE} />
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
                    <ReviewGuide title="資産" sections={ASSET_GUIDE} />
                    <ThemedText type="small">
                      積立元本 {yen(last.principal)} → 評価額 {yen(last.value)}
                    </ThemedText>
                    <ThemedText type="small">複利の分: {yen(last.comp)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      期間が短いため、複利の分はまだ小さな値です。
                    </ThemedText>
                  </ThemedView>

                  <ThemedView type="backgroundElement" style={card}>
                    <ReviewGuide title="値下がりの最中も続けた結果" sections={DRAWDOWN_GUIDE} />
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
  card: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderTopWidth: 1, paddingTop: Spacing.two },
  grow: { flex: 1 },
});
