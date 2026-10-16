import { gaugeLevel, type FxReview, type FxTrade, type GaugeLevel } from '@nekase/core';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const LEVEL: Record<GaugeLevel, string> = { high: '高', mid: '中', low: '低' };
const yen = (n: number) => `¥${Math.abs(n).toLocaleString('ja-JP')}`;
/** 色に頼らず、符号で示す。 */
const signed = (n: number) => (n > 0 ? `＋${yen(n)}` : n < 0 ? `−${yen(n)}` : yen(0));

/** 取引ログと、ゲージ別の成績。10 件に満たないうちは「参考値」。因果は断定しない。 */
export function TradeLog({ trades, review, aiReview }: { trades: readonly FxTrade[]; review: FxReview; aiReview: FxReview }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.line }]}>
      <ThemedText type="smallBold">取引ログ</ThemedText>
      {trades.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          まだ取引がありません。
        </ThemedText>
      ) : (
        [...trades].reverse().map((t) => (
          <View key={t.date} style={[styles.item, { borderTopColor: theme.line }]}>
            <ThemedText type="smallBold">
              {t.date} {t.side === 'buy' ? '▲ 買い' : '▼ 売り'} ¥{t.amount.toLocaleString('ja-JP')}
              {t.placedBy === 'ai' ? '【AI 代行】' : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              約定 {t.entryRate.toFixed(2)} / 損切り {t.stopPct}% / ゲージ {t.gauge}({LEVEL[gaugeLevel(t.gauge)]})
              {t.confirmReason ? ` / 理由: ${t.confirmReason}` : ''}
            </ThemedText>
            {t.aiComment && <ThemedText type="small">AI の理由: {t.aiComment}</ThemedText>}
            <ThemedText type="small">
              {t.pnl === null
                ? '保有中(翌日の終値で決済します)'
                : `決済 ${t.exitRate!.toFixed(2)}(${t.reason === 'stop' ? '損切り' : '終値'}) 損益 ${signed(t.pnl)}`}
            </ThemedText>
          </View>
        ))
      )}

      <ThemedText type="smallBold" style={styles.gap}>
        ゲージ別の成績{review.isReference ? '(参考値)' : ''}
      </ThemedText>
      {review.byLevel.map((s) => (
        <ThemedText key={s.level} type="small" themeColor="textSecondary">
          ゲージ「{LEVEL[s.level]}」: {s.count} 件
          {s.count > 0 ? ` / 勝った割合 ${Math.round(s.winRate! * 100)}% / 平均損益 ${signed(Math.round(s.avgPnl!))}` : ''}
        </ThemedText>
      ))}
      {aiReview.total > 0 && (
        <>
          <ThemedText type="smallBold" style={styles.gap}>
            AI 代行の成績{aiReview.isReference ? '(参考値)' : ''}
          </ThemedText>
          {aiReview.byLevel.map((s) => (
            <ThemedText key={s.level} type="small" themeColor="textSecondary">
              ゲージ「{LEVEL[s.level]}」の日: {s.count} 件
              {s.count > 0 ? ` / 勝った割合 ${Math.round(s.winRate! * 100)}% / 平均損益 ${signed(Math.round(s.avgPnl!))}` : ''}
            </ThemedText>
          ))}
        </>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {review.isReference ? '取引が 10 件に満たないため、参考値です。' : ''}
        睡眠と成績の関係は、傾向を見るための目安です。因果は断定できません。
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  item: { borderTopWidth: 1, paddingTop: Spacing.two, gap: Spacing.half },
  gap: { marginTop: Spacing.two },
});
