import { DEMO_RECORDS, DEMO_SETTINGS, eqDrawdown, simulate } from '@nekase/core';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

import { TaskCards } from '@/components/task-cards';
import { SleepEditForm } from '@/components/sleep-edit-form';
import { AssetLayers } from '@/components/chart/asset-layers';
import { ChartDefs } from '@/components/chart/chart-defs';
import { ChartSection } from '@/components/chart/chart-section';
import { SleepBars } from '@/components/chart/sleep-bars';
import { VIEW_H, W } from '@/components/chart/geometry';
import { SleepBar } from '@/components/sleep-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, WebTopInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNekase } from '@/state/nekase-provider';

const DEMO_SIM = simulate(DEMO_RECORDS, DEMO_SETTINGS);
const DEMO_DRAWDOWN = eqDrawdown();

function DemoGraphImage() {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="サンプル30日分の睡眠時刻と仮想資産の推移を示すグラフ"
      style={[styles.demoGraph, { borderColor: theme.line, backgroundColor: theme.background }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${VIEW_H}`}>
        <ChartDefs />
        <SleepBars
          records={DEMO_RECORDS}
          elapsed={DEMO_RECORDS.length}
          targetBed={DEMO_SETTINGS.targetBed}
          targetWake={DEMO_SETTINGS.targetWake}
          c={theme}
        />
        <AssetLayers sim={DEMO_SIM} elapsed={DEMO_SIM.length} dip={DEMO_DRAWDOWN} c={theme} />
      </Svg>
    </View>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const { notice } = useNekase();
  const [editing, setEditing] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heading}>
          <ThemedText type="subtitle">ホーム</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showExplanation }}
            onPress={() => setShowExplanation(!showExplanation)}
            style={styles.explanationButton}>
            <ThemedText type="small" themeColor="sleepInk" style={styles.underline}>
              (ホームの説明)
            </ThemedText>
          </Pressable>
        </View>
        {showExplanation && (
          <ThemedView type="backgroundElement" style={[styles.explanation, { borderColor: theme.line }]}>
            <View style={styles.guideSection}>
              <ThemedText type="smallBold">1. 行動課題（クエスト）</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                選んだ課題の達成状況を毎日記録します。就寝・起床時刻の課題は記録時刻から自動で判定し、画面を閉じる・カフェインを控える課題は自分でチェックします。達成状況に応じて仮想の積立額が決まり、未達成でも資産が減ることはありません。
              </ThemedText>
            </View>

            <View style={styles.guideSection}>
              <ThemedText type="smallBold">2. 睡眠と資産のグラフ</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                上段は日ごとの就寝から起床までの時刻、下段は仮想資産の推移です。グラフをなぞるか「前の日」「次の日」を押すと、表示する日を切り替えられます。
              </ThemedText>
              <DemoGraphImage />
              <ThemedText type="small" themeColor="textSecondary">
                サンプル30日分を使った表示例です。実際の記録や設定は変更されません。
              </ThemedText>
            </View>

            <View style={styles.guideSection}>
              <ThemedText type="smallBold">3. 評価額の内訳</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                選んだ日の仮想資産を、積立元本・運用益・複利の分に分けて確認できます。値下がりで元本を一時的に下回っている場合は、その分も表示します。実際のお金や売買ではありません。
              </ThemedText>
            </View>

            <View style={styles.guideSection}>
              <ThemedText type="smallBold">4. 時刻の修正</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                「時刻の修正」を押し、起床日を選んで就寝・起床時刻を入力し、「保存」します。記録済みの時刻を直すと、課題の達成状況やグラフにも反映されます。
              </ThemedText>
            </View>
          </ThemedView>
        )}
        {notice && <ThemedText themeColor="assetInk">{notice}</ThemedText>}
        <TaskCards />
        <ChartSection />
        {editing ? (
          <SleepEditForm onClose={() => setEditing(false)} />
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={styles.link}>
            <ThemedText type="small" themeColor="sleepInk" style={styles.underline}>
              時刻の修正
            </ThemedText>
          </Pressable>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          学習用のシミュレーションです。実際の売買や換金はできません
        </ThemedText>
        </ScrollView>
      </SafeAreaView>
      <SleepBar />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  scroll: { padding: Spacing.four, paddingTop: Spacing.four + WebTopInset, gap: Spacing.two, paddingBottom: BottomTabInset + 160 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  explanationButton: { minHeight: 44, justifyContent: 'center' },
  explanation: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.three },
  guideSection: { gap: Spacing.one },
  demoGraph: { width: '100%', maxWidth: 560, aspectRatio: W / VIEW_H, alignSelf: 'center', borderWidth: 1, borderRadius: Spacing.two, overflow: 'hidden' },
  link: { minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
