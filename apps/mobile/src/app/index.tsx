import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SleepBar } from '@/components/sleep-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useNekase } from '@/state/nekase-provider';

export default function HomeScreen() {
  const { notice, records } = useNekase();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">ホーム</ThemedText>
        {notice && <ThemedText themeColor="assetInk">{notice}</ThemedText>}
        <ThemedText themeColor="textSecondary">記録 {records.length} 件(作成中)</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          学習用のシミュレーションです。実際の売買や換金はできません
        </ThemedText>
      </SafeAreaView>
      <SleepBar />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.two,
    paddingBottom: BottomTabInset + 140,
    maxWidth: MaxContentWidth,
  },
});
