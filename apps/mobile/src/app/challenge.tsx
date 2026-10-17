import { FX_GRANT, FX_MAX_FUND, gaugeLevel } from '@nekase/core';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiDelegate } from '@/components/fx/ai-delegate';
import { OrderForm } from '@/components/fx/order-form';
import { RateChart } from '@/components/fx/rate-chart';
import { TradeLog } from '@/components/fx/trade-log';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, WebTopInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFx } from '@/hooks/use-fx';
import { useNekase } from '@/state/nekase-provider';

const LEVEL_TEXT = { high: '高め', mid: 'ふつう', low: '低め' } as const;
const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

const NOTE = '学習用のシミュレーションです。実際の売買や換金はできません。投資助言ではありません。';

export default function ChallengeScreen() {
  const theme = useTheme();
  const { ready, fxBase } = useNekase();
  const fx = useFx();

  const body = () => {
    if (!ready) return null;
    // 夜間ロック中は、チャレンジを開けない(資産・レート・損益も出さない)
    if (fx.locked) {
      return (
        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.line }]}>
          <ThemedText type="subtitle">おやすみの時間です</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            チャレンジは、日中だけ開けます。ゆっくり休みましょう。
          </ThemedText>
        </ThemedView>
      );
    }
    if (fx.phase === 'not_started' || fxBase.startDate === null) {
      return (
        <ThemedText themeColor="textSecondary">
          チャレンジは、30 日の開始日を決めると使えます。設定で開始日を入れてください。
        </ThemedText>
      );
    }
    const dayIndex = fx.dayIndex!;
    return (
      <>
        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.line }]}>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <ThemedText type="small" themeColor="textSecondary">
                {fx.phase === 'active' ? `今日(${dayIndex + 1}日目)の USD/JPY` : '期間は終了しました'}
              </ThemedText>
              <ThemedText type="subtitle">{fx.rate !== null ? fx.rate.toFixed(2) : '—'}</ThemedText>
            </View>
            <View style={styles.stat}>
              <ThemedText type="small" themeColor="textSecondary">
                チャレンジ資金
              </ThemedText>
              <ThemedText type="subtitle" style={{ color: theme.assetInk }}>
                {yen(fx.fund)}
              </ThemedText>
            </View>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            資金は積立資産とは別枠です。週 5 日クリアすると、翌週に {yen(FX_GRANT)} が付きます(上限 {yen(FX_MAX_FUND)})。
          </ThemedText>
          <RateChart startDate={fxBase.startDate} dayIndex={Math.min(dayIndex, 30)} trades={fx.trades} />
        </ThemedView>

        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.line }]}>
          <ThemedText type="smallBold">判断力ゲージ(目安)</ThemedText>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: fx.gauge }} style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.fill, { width: `${fx.gauge}%`, backgroundColor: theme.sleep }]} />
          </View>
          <ThemedText type="small">
            {fx.gauge} / 100(今日は「{LEVEL_TEXT[gaugeLevel(fx.gauge)]}」)
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            直近 7 日の就寝時刻の規則性から出した目安です。睡眠の長さやスコアは使いません。
            {fx.needsConfirm ? '低めの日は、注文の前に確認ステップが入り、注文額の上限が半分になります。' : ''}
          </ThemedText>
        </ThemedView>

        {fx.restSuggested && (
          <ThemedView type="assetSoft" style={[styles.card, { borderColor: theme.assetL2 }]}>
            <ThemedText type="smallBold" themeColor="assetInk">
              今日は休むのもひとつの手です
            </ThemedText>
            <ThemedText type="small" themeColor="assetInk">
              3 回続けて損失になっています。無理に注文しなくて大丈夫です(注文はできます)。
            </ThemedText>
          </ThemedView>
        )}

        {fx.phase === 'active' &&
          (fx.orderedToday ? (
            <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.line }]}>
              <ThemedText type="smallBold">
                {fx.aiSkipToday ? '今日は、AI が見送りました' : fx.open?.placedBy === 'ai' ? '今日の注文は、AI が行いました' : '今日の注文は済んでいます'}
              </ThemedText>
              {fx.aiSkipToday && fx.aiSkipToday.comment !== '' && (
                <ThemedText type="small">AI の理由: {fx.aiSkipToday.comment}</ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                注文は 1 日 1 回までです。{fx.aiSkipToday ? '今日は、自分で注文し直すことはできません。' : '結果は、明日の終値で決まります。'}
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              <OrderForm fx={fx} />
              <AiDelegate fx={fx} />
            </>
          ))}

        <TradeLog trades={fx.trades} review={fx.review} aiReview={fx.aiReview} />
      </>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle">チャレンジ</ThemedText>
          {body()}
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
  scroll: { padding: Spacing.four, paddingTop: Spacing.four + WebTopInset, gap: Spacing.three, paddingBottom: BottomTabInset + 160 },
  card: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  stats: { flexDirection: 'row', gap: Spacing.three },
  stat: { flex: 1, gap: Spacing.half },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: 12 },
});
