import { AI_PERSONA, gaugeLevel, type FxState } from '@nekase/core';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ConfirmPanel } from '@/components/fx/confirm-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNekase, type AiDelegateResult } from '@/state/nekase-provider';

const FAIL_TEXT = {
  limit: '今日は AI を呼べる回数の上限に達しました。自分で注文できます。',
  network: '通信できませんでした。注文はしていません。自分で注文できます。',
  unavailable: 'AI が使えませんでした。注文はしていません。自分で注文できます。',
} as const;

const BLOCK_TEXT: Record<string, string> = {
  locked: 'おやすみの時間のため、注文できません。',
  already_ordered: '注文は 1 日 1 回までです。',
  no_fund: '注文できる資金がありません。次の達成で、また始められます。',
  need_confirm: '確認ステップを終えてから、お願いします。',
  no_rate: '今日は注文できません。',
};

/** 「AI にまかせる」(任意)。就寝の規則性(ゲージ)に合わせた AI が、今日の注文を決める。計画書 §6.6 */
export function AiDelegate({ fx }: { fx: FxState }) {
  const theme = useTheme();
  const { delegateToAi } = useNekase();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiDelegateResult | null>(null);
  const persona = AI_PERSONA[gaugeLevel(fx.gauge)];

  const run = async (confirmed: boolean, reason: Parameters<typeof delegateToAi>[0]['reason']) => {
    setBusy(true);
    try {
      const r = await delegateToAi({ confirmed, reason });
      setResult(r);
      if (r.kind !== 'blocked') setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.line }]}>
      <ThemedText type="smallBold">AI にまかせる(任意)</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        今日の注文を、AI が決めて確定します(1 日 1 回。自分の注文の代わりです)。AI は、今日のゲージ(目安)に合わせた設定で判断します。
        今日の設定: 「{persona.label}」。
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        この設定は学習用の演出です。睡眠不足が実際にこうなると示すものではなく、結果は保証されません。投資助言ではありません。損切り・上限・夜間ロックは、AI の注文にも同じく適用されます。
      </ThemedText>

      {confirming ? (
        <ConfirmPanel
          intro="就寝時刻がばらついている傾向があります(目安)。AI にまかせる理由を選んでください。"
          confirmLabel="それでも AI にまかせる"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={(r) => run(true, r)}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => (fx.needsConfirm ? setConfirming(true) : run(false, null))}
          style={[styles.button, { borderColor: theme.sleep }, busy && styles.disabled]}>
          <ThemedText type="smallBold" themeColor="sleepInk">
            {busy ? 'AI が考えています…' : fx.needsConfirm ? '確認へ進む' : 'AI にまかせる'}
          </ThemedText>
        </Pressable>
      )}

      {result?.kind === 'failed' && (
        <ThemedText type="small" themeColor="assetInk">
          ⚠ {FAIL_TEXT[result.reason]}
        </ThemedText>
      )}
      {result?.kind === 'blocked' &&
        result.errors.map((e) => (
          <ThemedText key={e} type="small" themeColor="assetInk">
            ⚠ {BLOCK_TEXT[e] ?? 'いまは注文できません。'}
          </ThemedText>
        ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  button: { minHeight: 48, borderWidth: 2, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
