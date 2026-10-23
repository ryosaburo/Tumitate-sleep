import {
  FX_ORDER_STEP,
  FX_STOP_PCTS,
  stopLine,
  type FxReason,
  type FxState,
  type OrderError,
  type Side,
  type StopPct,
} from '@nekase/core';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChallengeGuide } from '@/components/fx/challenge-guide';
import { ConfirmPanel } from '@/components/fx/confirm-panel';
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

const SIDE_GUIDE_SECTIONS = [
  {
    heading: '円安・円高と買い・売り',
    paragraphs: [
      'このゲームでは、翌日のドル円が上がるか、下がるかを予想します。150円から151円になると円安、150円から149円になると円高です。',
      '「買い」はドル円が上がると利益になり、「売り」はドル円が下がると利益になります。予想と反対に動くと損失になります。',
      '仮想取引なので、実際にドルを購入・売却するわけではありません。',
    ],
  },
];

const AMOUNT_GUIDE_SECTIONS = [
  {
    heading: '注文額とは？',
    paragraphs: [
      '注文額は、チャレンジで使う金額のことです。',
      '金額を大きくすると、利益も損失も大きくなります。',
      '例えば、同じ値動きでも、',
      '・1,000円で注文すると、利益や損失は小さめ\n・2,000円で注文すると、利益や損失は約2倍',
      'になります。',
      '金額は「＋」「－」ボタンで1,000円ずつ変更できます。',
      '注文できる金額には上限があり、チャレンジ資金や判断力ゲージによって変わります。',
      '※ 注文額そのものが、チャレンジ資金から引かれるわけではありません。',
    ],
  },
];

const STOP_GUIDE_SECTIONS = [
  {
    heading: '損切りとは？',
    paragraphs: [
      '損切りは、予想が外れたときに、損失をどこまで許すか決める設定です。',
      '例えば、「円安になる」と予想したのに、実際には円高になってしまった場合に使われます。',
    ],
  },
  {
    heading: '3つの設定の違い',
    paragraphs: [
      '0.5％：損失を小さく抑えたい人向け\n少し予想と反対に動いただけでも、取引が終了しやすくなります。',
      '1％：中間の設定\n0.5％と2％の間の設定です。',
      '2％：少し大きな値動きまで待ちたい人向け\n予想と反対に動いても、0.5％より長く様子を見る設定です。',
    ],
  },
  {
    heading: '例えば、2,000円で注文した場合',
    paragraphs: [
      '・0.5％ → 損失は約10円\n・1％ → 損失は約20円\n・2％ → 損失は約40円',
      'これは、損切りが実行された場合のゲーム内の目安です。',
      '損切りの数字は、利益の大きさを決めるものではありません。',
      '※ このゲームでは翌日の架空レートをもとに判定するため、実際のFXのように値動きを常に監視しているわけではありません。',
    ],
  },
];

/** 注文フォーム。損切りは必須。ゲージが低い日は、理由の選択 → 10 秒 → 再確認を挟む。 */
export function OrderForm({ fx }: { fx: FxState }) {
  const theme = useTheme();
  const { placeFxOrder } = useNekase();
  const [side, setSide] = useState<Side | null>(null);
  const [amount, setAmount] = useState(FX_ORDER_STEP);
  const [stop, setStop] = useState<StopPct | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [errors, setErrors] = useState<OrderError[]>([]);

  // 上限が変わったら(資金やゲージが変わったとき)、注文額を収める
  const cap = Math.max(fx.limit, 0);
  const amt = Math.min(Math.max(amount, Math.min(FX_ORDER_STEP, cap)), cap);

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
  const submit = async (confirmed: boolean, reason: FxReason | null = null) => {
    if (!ready) return;
    const res = await placeFxOrder({ side, amount: amt, stopPct: stop }, { confirmed, reason });
    setErrors(res);
    if (res.length === 0) {
      setConfirming(false);
      setSide(null);
      setStop(null);
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

      <ChallengeGuide title="買い・売りについて" sections={SIDE_GUIDE_SECTIONS} />
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

      <ChallengeGuide title="注文額について" sections={AMOUNT_GUIDE_SECTIONS} />
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
      <ChallengeGuide title="損切りについて" sections={STOP_GUIDE_SECTIONS} />
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
        <ConfirmPanel
          intro="就寝時刻がばらついている傾向があります(目安)。注文する理由を選んでください。"
          confirmLabel="それでも注文する"
          onCancel={() => setConfirming(false)}
          onConfirm={(r) => submit(true, r)}
        />
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
  chip: { flexGrow: 1, minHeight: 44, borderWidth: 2, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  step: { width: 44, minHeight: 44, borderWidth: 1, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  amount: { flex: 1, alignItems: 'center' },
  submit: { minHeight: 48, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
