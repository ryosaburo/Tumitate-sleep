import { clock, toAxisMinutes } from '@nekase/core';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNekase } from '@/state/nekase-provider';

function hhmm(ts: number): string {
  const d = new Date(ts);
  return clock(toAxisMinutes(d.getHours(), d.getMinutes()));
}

/** 画面下の固定バー。「ねる」「おきた」を押して、時刻を保存する。 */
export function SleepBar() {
  const theme = useTheme();
  const { ready, pending, pressBed, cancelBed, pressWake } = useNekase();
  const sleeping = pending.kind === 'sleeping';

  return (
    <ThemedView type="backgroundElement" style={[styles.bar, { borderTopColor: theme.line }]}>
      <View style={styles.inner}>
        {sleeping && (
          <View style={styles.status}>
            <ThemedText type="small">{hhmm(pending.bedTs)} に「ねる」を押しました</ThemedText>
            <Pressable accessibilityRole="button" onPress={cancelBed} style={styles.cancel}>
              <ThemedText type="small" themeColor="sleepInk" style={styles.underline}>
                取り消す
              </ThemedText>
            </Pressable>
          </View>
        )}
        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready || sleeping }}
            disabled={!ready || sleeping}
            onPress={pressBed}
            style={[styles.button, { backgroundColor: theme.sleep }, (!ready || sleeping) && styles.disabled]}>
            <ThemedText type="smallBold" style={{ color: theme.onSleep }}>
              ねる
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready || !sleeping }}
            disabled={!ready || !sleeping}
            onPress={pressWake}
            style={[
              styles.button,
              { borderColor: theme.sleep, borderWidth: 2 },
              (!ready || !sleeping) && styles.disabled,
            ]}>
            <ThemedText type="smallBold" themeColor="sleepInk">
              おきた
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.two },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
  underline: { textDecorationLine: 'underline' },
  buttons: { flexDirection: 'row', gap: Spacing.three },
  button: {
    flex: 1,
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});
