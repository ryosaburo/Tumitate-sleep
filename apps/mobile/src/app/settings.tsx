import { clock, normalizeStartDate, normalizeTime, PRESETS, toggleTask, type PresetKey, type TaskKey } from '@nekase/core';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinkCard } from '@/components/link-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, WebTopInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNekase } from '@/state/nekase-provider';

const TASK_LABELS: Record<TaskKey, string> = {
  bed: '就寝時刻を守る',
  wake: '起床時刻をそろえる',
  screen: '寝る1時間前に画面を閉じる',
  caffeine: '夕方以降はカフェインを控える',
};
const TASK_ORDER: TaskKey[] = ['bed', 'wake', 'screen', 'caffeine'];

export default function SettingsScreen() {
  const theme = useTheme();
  const { ready, settings, settingsRow, today, saveSettings, resetAll, chart, setDemo } = useNekase();
  const [bed, setBed] = useState(settingsRow.target_bed);
  const [wake, setWake] = useState(settingsRow.target_wake);
  const [start, setStart] = useState(settingsRow.start_date ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [allocationGuideOpen, setAllocationGuideOpen] = useState(false);
  const [usageGuideOpen, setUsageGuideOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const allocationY = useRef<number | null>(null);
  const allocationScrollPending = useRef(false);

  const scrollToAllocation = () => {
    if (!allocationScrollPending.current || allocationY.current === null || !scrollRef.current) return;
    scrollRef.current.scrollTo({ y: Math.max(0, allocationY.current - WebTopInset - Spacing.two), animated: true });
    allocationScrollPending.current = false;
  };

  const openAllocationGuide = () => {
    allocationScrollPending.current = true;
    setAllocationGuideOpen(true);
    // すでに開いていれば、そのまま移動する。閉じていれば、展開後のレイアウト更新を待つ。
    if (allocationGuideOpen) scrollToAllocation();
  };

  // 保存データの読み込みが終わったら、入力欄に反映する
  useEffect(() => {
    setBed(settingsRow.target_bed);
    setWake(settingsRow.target_wake);
    setStart(settingsRow.start_date ?? '');
  }, [ready, settingsRow.target_bed, settingsRow.target_wake, settingsRow.start_date]);

  const saveTimes = async () => {
    const b = normalizeTime(bed);
    const w = normalizeTime(wake);
    const sd = normalizeStartDate(start);
    if (!b || !w) return setMessage('⚠ 目標時刻は HH:MM の形で入れてください。');
    if (sd === undefined) return setMessage('⚠ 開始日は、実在する日付を YYYY-MM-DD の形で入れてください。(空なら未設定)');
    await saveSettings({ target_bed: b, target_wake: w, start_date: sd });
    setMessage('✓ 保存しました');
  };

  const onTask = async (t: TaskKey) => {
    const r = toggleTask(settings.tasks, t);
    if (!r.ok) return setTaskMessage(`⚠ ${r.error}`);
    await saveSettings({ tasks_json: JSON.stringify(r.tasks) });
    setMessage(null);
    setTaskMessage(null);
  };

  const input = [styles.input, { borderColor: theme.line, color: theme.text, backgroundColor: theme.background }];
  const card = [styles.card, { borderColor: theme.line }];
  const guideLink = [styles.underline, { color: theme.sleepInk }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} onContentSizeChange={scrollToAllocation}>
          <View style={styles.allocationHeader}>
            <ThemedText type="subtitle" style={styles.allocationTitle}>設定</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={usageGuideOpen ? '設定画面の使い方を閉じる' : '設定画面の使い方を見る'}
              accessibilityState={{ expanded: usageGuideOpen }}
              onPress={() => setUsageGuideOpen((open) => !open)}
              style={styles.allocationGuideButton}>
              <ThemedText type="small" themeColor="sleepInk" style={styles.underline}>
                {usageGuideOpen ? '閉じる' : '使い方を見る'}
              </ThemedText>
            </Pressable>
          </View>
          {usageGuideOpen && (
            <ThemedView type="backgroundElement" style={[card, styles.usageGuide]}>
              <View style={styles.allocationGuideSection}>
                <ThemedText type="smallBold">目標時刻</ThemedText>
                <ThemedText type="small">
                  毎日の目標となる就寝時刻と起床時刻を設定します。設定した時間をもとに、
                  <Link href="/review" accessibilityRole="link" accessibilityLabel="達成状況を振り返り画面で見る" style={guideLink}>達成状況</Link>
                  を確認できます。
                </ThemedText>
              </View>
              <View style={styles.allocationGuideSection}>
                <ThemedText type="smallBold">開始日</ThemedText>
                <ThemedText type="small">
                  <Link href={{ pathname: '/', params: { section: 'graph' } }} accessibilityRole="link" accessibilityLabel="睡眠習慣の記録をホーム画面で見る" style={guideLink}>睡眠習慣の記録</Link>
                  と
                  <Link href={{ pathname: '/', params: { section: 'graph' } }} accessibilityRole="link" accessibilityLabel="仮想積立をホーム画面で見る" style={guideLink}>仮想積立</Link>
                  のシミュレーションを始める日を設定します。
                </ThemedText>
                <ThemedText type="small">
                  開始日を設定すると、
                  <Link href={{ pathname: '/', params: { section: 'graph' } }} accessibilityRole="link" accessibilityLabel="睡眠習慣の記録をホーム画面で見る" style={guideLink}>睡眠習慣の記録</Link>
                  や
                  <Link href={{ pathname: '/', params: { section: 'graph' } }} accessibilityRole="link" accessibilityLabel="仮想積立をホーム画面で見る" style={guideLink}>仮想積立</Link>
                  の変化を確認できます。
                </ThemedText>
                <ThemedText type="small">
                  また、開始日を設定して保存すると、開始日以降に
                  <Link href="/challenge" accessibilityRole="link" accessibilityLabel="チャレンジ機能の画面を開く" style={guideLink}>チャレンジ機能</Link>
                  を利用できます。
                </ThemedText>
                <ThemedText type="small">新しい注文ができる期間は開始日から30日間で、夜間など利用できない時間帯もあります。</ThemedText>
              </View>
              <View style={styles.allocationGuideSection}>
                <ThemedText type="smallBold">行動課題</ThemedText>
                <ThemedText type="small">睡眠習慣を改善するために、毎日取り組む課題を選びます。</ThemedText>
                <ThemedText type="small">課題を達成すると、仮想のお金を積み立てられます。</ThemedText>
              </View>
              <View style={styles.allocationGuideSection}>
                <ThemedText type="smallBold">積立の配分</ThemedText>
                <ThemedText type="small">積み立てた仮想のお金を、世界株式・債券・現金に振り分ける割合を選びます。</ThemedText>
                <ThemedText type="small">「守り重視」「バランス」「成長重視」の3種類から選択できます。</ThemedText>
                <ThemedText type="small">
                  それぞれの違いは、積立の配分の「
                  <ThemedText
                    type="small"
                    accessibilityRole="button"
                    accessibilityLabel="積立の配分の説明を開いて移動する"
                    accessibilityState={{ expanded: allocationGuideOpen }}
                    onPress={openAllocationGuide}
                    style={guideLink}>詳しく見る</ThemedText>
                  」から確認できます。
                </ThemedText>
              </View>
            </ThemedView>
          )}
          {message && (
            <ThemedText type="small" style={{ color: message.startsWith('✓') ? theme.goodInk : theme.assetInk }}>
              {message}
            </ThemedText>
          )}

          <ThemedView type="backgroundElement" style={card}>
            <ThemedText type="smallBold">目標時刻と開始日</ThemedText>
            <View style={styles.row}>
              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">目標の就寝</ThemedText>
                <TextInput value={bed} onChangeText={setBed} maxLength={5} placeholder="23:30" placeholderTextColor={theme.textSecondary} style={input} />
              </View>
              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">目標の起床</ThemedText>
                <TextInput value={wake} onChangeText={setWake} maxLength={5} placeholder="06:30" placeholderTextColor={theme.textSecondary} style={input} />
              </View>
            </View>
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">開始日(YYYY-MM-DD。空なら未設定)</ThemedText>
              <TextInput value={start} onChangeText={setStart} maxLength={10} placeholder="2026-10-12" placeholderTextColor={theme.textSecondary} style={input} />
              <Pressable accessibilityRole="button" onPress={() => setStart(today)} style={styles.link}>
                <ThemedText type="small" themeColor="sleepInk" style={styles.underline}>今日にする</ThemedText>
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" onPress={saveTimes} style={[styles.button, { backgroundColor: theme.sleep }]}>
              <ThemedText type="smallBold" style={{ color: theme.onSleep }}>保存</ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              いまの目標: 就寝 {clock(settings.targetBed)} / 起床 {clock(settings.targetWake)}(前後30分が達成)
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={card}>
            <ThemedText type="smallBold">行動課題(2〜3個)</ThemedText>
            {TASK_ORDER.map((t) => {
              const on = settings.tasks.includes(t);
              return (
                <Pressable
                  key={t}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => onTask(t)}
                  style={[styles.option, { borderColor: on ? theme.sleep : theme.line, borderWidth: on ? 2 : 1 }]}>
                  <ThemedText type="smallBold" themeColor={on ? 'sleepInk' : 'text'}>{on ? '☑' : '☐'}</ThemedText>
                  <ThemedText type="small" style={styles.grow}>{TASK_LABELS[t]}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{t === 'screen' || t === 'caffeine' ? '自己申告' : '自動'}</ThemedText>
                </Pressable>
              );
            })}
            {taskMessage && (
              <ThemedText type="small" style={{ color: theme.assetInk }}>
                {taskMessage}
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView
            type="backgroundElement"
            style={card}
            onLayout={(event) => {
              allocationY.current = event.nativeEvent.layout.y;
            }}>
            <View style={styles.allocationHeader}>
              <ThemedText type="smallBold" style={styles.allocationTitle}>積立の配分(世界株式 / 債券 / 現金)</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={allocationGuideOpen ? '積立の配分の説明を閉じる' : '積立の配分の説明を詳しく見る'}
                accessibilityState={{ expanded: allocationGuideOpen }}
                onPress={() => setAllocationGuideOpen((open) => !open)}
                style={styles.allocationGuideButton}>
                <ThemedText type="small" themeColor="sleepInk" style={styles.underline}>
                  {allocationGuideOpen ? '閉じる' : '詳しく見る'}
                </ThemedText>
              </Pressable>
            </View>
            {allocationGuideOpen && (
              <View style={styles.allocationGuide}>
                <View style={styles.allocationGuideSection}>
                  <ThemedText type="smallBold">積立の配分とは？</ThemedText>
                  <ThemedText type="small">積み立てた仮想のお金を、世界株式・債券・現金の3種類にどのくらい振り分けるかを決めることです。</ThemedText>
                </View>
                <View style={styles.allocationGuideSection}>
                  <ThemedText type="smallBold">世界株式とは？</ThemedText>
                  <ThemedText type="small">世界中の企業の株式に投資することです。大きく増える可能性がありますが、値下がりするリスクもあります。</ThemedText>
                </View>
                <View style={styles.allocationGuideSection}>
                  <ThemedText type="smallBold">債券とは？</ThemedText>
                  <ThemedText type="small">国や企業などがお金を借りるために発行するものです。一般的に株式より値動きが小さい傾向がありますが、損失が発生する可能性もあります。</ThemedText>
                </View>
                <View style={styles.allocationGuideSection}>
                  <ThemedText type="smallBold">現金とは？</ThemedText>
                  <ThemedText type="small">投資せずに保有しておくお金です。ねかせのシミュレーションでは価格が変動しません。</ThemedText>
                </View>
                <View style={styles.allocationGuideSection}>
                  <ThemedText type="smallBold">3つのコースの違い</ThemedText>
                  <ThemedText type="smallBold">守り重視：</ThemedText>
                  <ThemedText type="small">値動きをなるべく抑えたい人向け。</ThemedText>
                  <ThemedText type="smallBold">バランス：</ThemedText>
                  <ThemedText type="small">安定性と成長の両方を重視したい人向け。</ThemedText>
                  <ThemedText type="smallBold">成長重視：</ThemedText>
                  <ThemedText type="small">大きな値動きを受け入れて、資産の成長を目指したい人向け。</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  ※このアプリは学習用のシミュレーションです。実際の投資とは結果が異なります。
                </ThemedText>
              </View>
            )}
            {(Object.keys(PRESETS) as PresetKey[]).map((k) => {
              const p = PRESETS[k];
              const on = settings.preset === k;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => saveSettings({ preset: k })}
                  style={[styles.option, { borderColor: on ? theme.asset : theme.line, borderWidth: on ? 2 : 1 }]}>
                  <ThemedText type="smallBold" themeColor={on ? 'assetInk' : 'text'}>{on ? '●' : '○'}</ThemedText>
                  <ThemedText type="small" style={styles.grow}>{p.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {Math.round(p.eq * 100)} / {Math.round(p.bd * 100)} / {Math.round(p.cash * 100)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ThemedView>

          <LinkCard />

          <ThemedView type="backgroundElement" style={card}>
            <ThemedText type="smallBold">デモデータ</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              サンプルの30日分で、グラフを確認できます。自分の記録は変わりません。再読み込みで元に戻ります。
            </ThemedText>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: chart.demo }}
              onPress={() => setDemo(!chart.demo)}
              style={[styles.option, { borderColor: chart.demo ? theme.sleep : theme.line, borderWidth: chart.demo ? 2 : 1 }]}>
              <ThemedText type="smallBold" themeColor={chart.demo ? 'sleepInk' : 'text'}>{chart.demo ? '☑' : '☐'}</ThemedText>
              <ThemedText type="small" style={styles.grow}>デモデータを表示する</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{chart.demo ? '表示中' : '非表示'}</ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedView type="backgroundElement" style={card}>
            <ThemedText type="smallBold">リセット</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">この端末の記録と設定をすべて消し、引き継ぎも解除します。ほかの端末の記録は消えません。元に戻せません。</ThemedText>
            {confirmReset ? (
              <View style={styles.row}>
                <Pressable accessibilityRole="button" onPress={() => setConfirmReset(false)} style={[styles.button, styles.grow, { borderColor: theme.sleep, borderWidth: 2 }]}>
                  <ThemedText type="smallBold" themeColor="sleepInk">やめる</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={async () => {
                    await resetAll();
                    setConfirmReset(false);
                    setMessage('✓ リセットしました');
                  }}
                  style={[styles.button, styles.grow, { backgroundColor: theme.assetL3 }]}>
                  <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>本当に消す</ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setConfirmReset(true)} style={[styles.button, { borderColor: theme.assetL3, borderWidth: 2 }]}>
                <ThemedText type="smallBold" themeColor="assetInk">リセットする</ThemedText>
              </Pressable>
            )}
          </ThemedView>

          <ThemedText type="small" themeColor="textSecondary">
            学習用のシミュレーションです。実際の売買や換金はできません
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  scroll: { padding: Spacing.four, paddingTop: Spacing.four + WebTopInset, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.six },
  card: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  allocationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  allocationTitle: { flex: 1, minWidth: 0 },
  allocationGuideButton: { minHeight: 44, flexShrink: 0, justifyContent: 'center', paddingHorizontal: Spacing.one },
  allocationGuide: { gap: Spacing.three, paddingVertical: Spacing.two },
  allocationGuideSection: { gap: Spacing.one },
  usageGuide: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three },
  field: { flex: 1, gap: Spacing.one },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 16 },
  link: { minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  button: { minHeight: 48, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Spacing.two, paddingHorizontal: Spacing.three },
  grow: { flex: 1 },
});
