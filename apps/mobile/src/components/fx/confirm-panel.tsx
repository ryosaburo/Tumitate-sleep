import { FX_CONFIRM_SECONDS, FX_REASONS, type FxReason } from '@nekase/core';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * 確認ステップ(ゲージが低い日): 理由の選択 → 10 秒 → 「それでも〜」。
 * 自分の注文と、「AI にまかせる」の前の、両方で使う。
 */
export function ConfirmPanel({
  intro,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: {
  intro: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: FxReason) => void;
}) {
  const theme = useTheme();
  const [reason, setReason] = useState<FxReason | null>(null);
  const [seconds, setSeconds] = useState(FX_CONFIRM_SECONDS);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const chip = (selected: boolean) => [
    styles.chip,
    { borderColor: selected ? theme.sleep : theme.line, backgroundColor: selected ? theme.backgroundSelected : 'transparent' },
  ];
  const blocked = seconds > 0 || reason === null || busy;

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">いったん立ち止まりましょう</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {intro}
      </ThemedText>
      <View style={styles.reasons}>
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
        <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.chip, { borderColor: theme.line }]}>
          <ThemedText type="smallBold">やめる</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: blocked }}
          disabled={blocked}
          onPress={() => reason && onConfirm(reason)}
          style={[styles.chip, { backgroundColor: theme.sleep, borderColor: theme.sleep }, blocked && styles.disabled]}>
          <ThemedText type="smallBold" style={{ color: theme.onSleep }}>
            {confirmLabel}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { flexGrow: 1, minHeight: 44, borderWidth: 2, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
