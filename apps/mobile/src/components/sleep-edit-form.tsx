import { addDays, clock, dateKey, validateSleepEdit } from '@nekase/core';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNekase } from '@/state/nekase-provider';

/** 時刻の修正フォーム。起床日を選び、就寝・起床を HH:MM で入れる。 */
export function SleepEditForm({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const { records, saveSleep } = useNekase();
  const today = dateKey(new Date());
  const [date, setDate] = useState(today);
  const [bed, setBed] = useState('');
  const [wake, setWake] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // 日付を変えたら、その日の記録を入れ直す
  useEffect(() => {
    const r = records.find((x) => x.date === date);
    setBed(r?.bed_min != null ? clock(r.bed_min) : '');
    setWake(r?.wake_min != null ? clock(r.wake_min) : '');
    setMessage(null);
  }, [date, records]);

  const save = async () => {
    const res = validateSleepEdit({ date, bed, wake }, today);
    if (!res.ok) {
      setMessage({ text: `⚠ ${res.error}`, ok: false });
      return;
    }
    await saveSleep(res.date, res.bed, res.wake);
    setMessage({ text: '✓ 保存しました', ok: true });
  };

  const inputStyle = [styles.input, { borderColor: theme.line, color: theme.text, backgroundColor: theme.background }];

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.line }]}>
      <ThemedText type="smallBold">時刻の修正</ThemedText>

      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="前の日" onPress={() => setDate(addDays(date, -1))} style={styles.step}>
          <ThemedText>◀</ThemedText>
        </Pressable>
        <ThemedText type="smallBold" style={styles.date}>
          {date}(起床日)
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="次の日"
          disabled={date >= today}
          onPress={() => setDate(addDays(date, 1))}
          style={[styles.step, date >= today && styles.disabled]}>
          <ThemedText>▶</ThemedText>
        </Pressable>
      </View>

      <View style={styles.row}>
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            就寝(例 23:30)
          </ThemedText>
          <TextInput value={bed} onChangeText={setBed} placeholder="HH:MM" placeholderTextColor={theme.textSecondary} style={inputStyle} maxLength={5} />
        </View>
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            起床(例 06:30)
          </ThemedText>
          <TextInput value={wake} onChangeText={setWake} placeholder="HH:MM" placeholderTextColor={theme.textSecondary} style={inputStyle} maxLength={5} />
        </View>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        起床は就寝より後で、16時間以内。睡眠時間は推定値です。
      </ThemedText>
      {message && (
        <ThemedText type="small" style={{ color: message.ok ? theme.goodInk : theme.assetInk }}>
          {message.text}
        </ThemedText>
      )}

      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onClose} style={[styles.button, { borderColor: theme.sleep, borderWidth: 2 }]}>
          <ThemedText type="smallBold" themeColor="sleepInk">
            閉じる
          </ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={save} style={[styles.button, { backgroundColor: theme.sleep }]}>
          <ThemedText type="smallBold" style={{ color: theme.onSleep }}>
            保存
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  step: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  date: { flex: 1, textAlign: 'center' },
  field: { flex: 1, gap: Spacing.one },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 16 },
  button: { flex: 1, minHeight: 48, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
