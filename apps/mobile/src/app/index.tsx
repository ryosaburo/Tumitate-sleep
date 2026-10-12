import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SleepEditForm } from '@/components/sleep-edit-form';
import { SleepBar } from '@/components/sleep-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useNekase } from '@/state/nekase-provider';

export default function HomeScreen() {
  const { notice, records } = useNekase();
  const [editing, setEditing] = useState(false);
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="subtitle">ホーム</ThemedText>
        {notice && <ThemedText themeColor="assetInk">{notice}</ThemedText>}
        <ThemedText themeColor="textSecondary">記録 {records.length} 件(作成中)</ThemedText>
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
  scroll: { padding: Spacing.four, gap: Spacing.two, paddingBottom: BottomTabInset + 160 },
  link: { minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
