import {
  FX_CONFIRM_SECONDS,
  FX_ORDER_STEP,
  FX_REASONS,
  FX_STOP_PCTS,
  stopLine,
  type FxReason,
  type FxState,
  type OrderError,
  type Side,
  type StopPct,
} from '@nekase/core';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNekase } from '@/state/nekase-provider';

const ERROR_TEXT: Record<OrderError, string> = {
  locked: 'おやすみの時間のため、注文できません。',
  already_ordered: '注文は 1 日 1 回までです。',
  no_fund: 'いまは注文できる資金がありません。次の達成で、また始められます。',
  bad_amount: '注文額は ¥1,000 刻みで選んでください。',
  over_limit: '注文額が上限を超えています。',
  bad_stop: '損切りを選んでください。',
  need_confirm: '確認ステップを終えてから、注文してください。',
  no_rate: '今日は注文できません。',
};

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

/** 注文フォーム。損切りは必須。ゲージが低い日は、理由の選択 → 10 秒 → 再確認を挟む。 */
export function OrderForm({ fx }: { fx: FxState }) {
  const theme = useTheme();
  const { placeFxOrder } = useNekase();
  const [side, setSide] = useState<Side | null>(null);
  const [amount, setAmount] = useState(FX_ORDER_STEP);
  const [stop, setStop] = useState<StopPct | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState<FxReason | null>(null);
  const [seconds, setSeconds] = useState(FX_CONFIRM_SECONDS);
  const [errors, setErrors] = useState<OrderError[]>([]);

  // 上限が変わったら(資金やゲージが変わったとき)、注文額を収める
  const cap = Math.max(fx.limit, 0);
  const amt = Math.min(Math.max(amount, Math.min(FX_ORDER_STEP, cap)), cap);

  useEffect(() => {
    if (!confirming) return;
    setSeconds(FX_CONFIRM_SECONDS);
    const id = setInterval(() => setSeconds((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [confirming]);

  if (cap <= 0) {
    return (
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.line }]}>
        <ThemedText type="smallBold">注文</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {ERROR_TEXT.no_fund}
        </ThemedText>
      </ThemedView>
    );
  }

  const ready = side !== null && stop !== null;
  const submit = async (confirmed: boolean) => {
    if (!ready) return;
    const res = await placeFxOrder({ side, amount: amt, stopPct: stop }, { confirmed, reason });
    setErrors(res);
    if (res.length === 0) {
      setConfirming(false);
      setSide(null);
      setStop(null);
      setReason(null);
    }
  };

  const chip = (selected: boolean) => [
    styles.chip,
    { borderColor: selected ? theme.sleep : theme.line, backgroundColor: selected ? theme.backgroundSelected : 'transparent' },
  ];
  const line = ready && fx.rate !== null ? stopLine(fx.rate, side, stop) : null;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.line }]}>
      <ThemedText type="smallBold">注文(1 日 1 回)</ThemedText>

      <View style={styles.row}>
        {(['buy', 'sell'] as const).map((s) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityState={{ selected: side === s }}
            onPress={() => setSide(s)}
            style={chip(side === s)}>
            <ThemedText type="smallBold">{s === 'buy' ? '▲ 円安になる(買い)' : '▼ 円高になる(売り)'}</ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="注文額を減らす"
          disabled={amt <= FX_ORDER_STEP}
          onPress={() => setAmount(amt - FX_ORDER_STEP)}
          style={[styles.step, { borderColor: theme.line }, amt <= FX_ORDER_STEP && styles.disabled]}>
          <ThemedText>−</ThemedText>
        </Pressable>
        <View style={styles.amount}>
          <ThemedText type="subtitle">{yen(amt)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            上限 {yen(cap)}(資金の20%{fx.needsConfirm ? '・ゲージが低い日は半分' : ''})
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="注文額を増やす"
          disabled={amt + FX_ORDER_STEP > cap}
          onPress={() => setAmount(amt + FX_ORDER_STEP)}
          style={[styles.step, { borderColor: theme.line }, amt + FX_ORDER_STEP > cap && styles.disabled]}>
          <ThemedText>＋</ThemedText>
        </Pressable>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        損切り(必須)
      </ThemedText>
      <View style={styles.row}>
        {FX_STOP_PCTS.map((p) => (
          <Pressable key={p} accessibilityRole="button" accessibilityState={{ selected: stop === p }} onPress={() => setStop(p)} style={chip(stop === p)}>
            <ThemedText type="smallBold">{p}%</ThemedText>
          </Pressable>
        ))}
      </View>
      {line !== null && (
        <ThemedText type="small" themeColor="textSecondary">
          約定レート {fx.rate!.toFixed(2)} → 損切りライン {line.toFixed(2)}。翌日の終値で決済します。
        </ThemedText>
      )}

      {fx.needsConfirm && confirming ? (
        <View style={styles.confirm}>
          <ThemedText type="smallBold">いったん立ち止まりましょう</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            就寝時刻がばらついている傾向があります(目安)。注文する理由を選んでください。
          </ThemedText>
          <View style={styles.wrap}>
            {FX_REASONS.map((r) => (
              <Pressable key={r} accessibilityRole="button" accessibilityState={{ selected: reason === r }} onPress={() => setReason(r)} style={chip(reason === r)}>
                <ThemedText type="small">{r}</ThemedText>
              </Pressable>
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {seconds > 0 ? `あと ${seconds} 秒、考える時間です。` : '考える時間が終わりました。'}
          </ThemedText>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" onPress={() => setConfirming(false)} style={[styles.chip, { borderColor: theme.line }]}>
              <ThemedText type="smallBold">やめる</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: seconds > 0 || reason === null }}
              disabled={seconds > 0 || reason === null}
              onPress={() => submit(true)}
              style={[styles.chip, { backgroundColor: theme.sleep, borderColor: theme.sleep }, (seconds > 0 || reason === null) && styles.disabled]}>
              <ThemedText type="smallBold" style={{ color: theme.onSleep }}>
                それでも注文する
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          disabled={!ready}
          onPress={() => (fx.needsConfirm ? setConfirming(true) : submit(false))}
          style={[styles.submit, { backgroundColor: theme.sleep }, !ready && styles.disabled]}>
          <ThemedText type="smallBold" style={{ color: theme.onSleep }}>
            {fx.needsConfirm ? '確認へ進む' : '注文する'}
          </ThemedText>
        </Pressable>
      )}

      {errors.map((e) => (
        <ThemedText key={e} type="small" themeColor="assetInk">
          ⚠ {ERROR_TEXT[e]}
        </ThemedText>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { flexGrow: 1, minHeight: 44, borderWidth: 2, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  step: { width: 44, minHeight: 44, borderWidth: 1, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  amount: { flex: 1, alignItems: 'center' },
  confirm: { gap: Spacing.two },
  submit: { minHeight: 48, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
