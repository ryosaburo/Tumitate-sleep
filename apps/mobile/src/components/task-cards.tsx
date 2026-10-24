import { clock, dayStat, isDone, type TaskKey } from '@nekase/core';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toDayRecord } from '@/state/convert';
import { useNekase } from '@/state/nekase-provider';

const LABELS: Record<TaskKey, string> = {
  bed: '就寝時刻を守る',
  wake: '起床時刻をそろえる',
  screen: '寝る1時間前に画面を閉じる',
  caffeine: '夕方以降はカフェインを控える',
};

/** 行動課題のカードと、今日の積立額。報酬は行動にだけ付ける(睡眠の長さやスコアでは決めない)。 */
export function TaskCards() {
  const theme = useTheme();
  const { settings, records, today, toggleSelf } = useNekase();
  const rec = toDayRecord(records.find((r) => r.date === today));
  const stat = dayStat(rec, settings);

  const desc = (t: TaskKey): string => {
    if (t === 'bed') return `目標の${clock(settings.targetBed)}から前後30分以内に眠る(自動)`;
    if (t === 'wake') return `目標の${clock(settings.targetWake)}から前後30分以内に起きる(自動)`;
    return t === 'screen' ? 'スマホやPCを見ない。このアプリは対象外(自己申告)' : 'コーヒー、緑茶、エナジードリンクなど(自己申告)';
  };

  return (
    <View style={styles.wrap}>
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.assetL2 }]}>
        <ThemedText type="small" themeColor="textSecondary">
          今日の積立額
        </ThemedText>
        <ThemedText type="subtitle" style={{ color: theme.assetInk }}>
          ¥{stat.contrib.toLocaleString('ja-JP')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {stat.n} / {stat.k} 個達成{stat.clear ? '(クリア日)' : ''}。できなかった日は、積立が止まるだけです。
        </ThemedText>
      </ThemedView>

      {settings.tasks.map((t) => {
        const done = isDone(rec, t, settings);
        const self = t === 'screen' || t === 'caffeine';
        const body = (
          <>
            <View style={[styles.mark, { borderColor: done ? theme.good : theme.line, backgroundColor: done ? theme.good : 'transparent' }]}>
              <ThemedText type="smallBold" style={{ color: theme.onGood }}>
                {done ? '✓' : ''}
              </ThemedText>
            </View>
            <View style={styles.text}>
              <ThemedText type="smallBold">{LABELS[t]}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {desc(t)}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor={done ? 'goodInk' : 'textSecondary'}>
              {done ? '達成' : '未達成'}
            </ThemedText>
          </>
        );
        const style = [styles.task, { borderColor: theme.line }];
        return self ? (
          <Pressable
            key={t}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            onPress={() => toggleSelf(t)}
            style={style}>
            {body}
          </Pressable>
        ) : (
          <View key={t} style={style}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  card: { borderWidth: 2, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  task: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  mark: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: Spacing.half },
});
