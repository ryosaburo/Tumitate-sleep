import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ReviewGuideProps = {
  title: string;
  titleType?: 'subtitle' | 'smallBold';
  openLabel?: '使い方を見る' | '詳しく見る';
  sections: readonly { heading: string; paragraphs: readonly string[] }[];
};

/** 説明文だけを開閉し、記録や集計の状態には触れない。 */
export function ReviewGuide({ title, titleType = 'smallBold', openLabel = '詳しく見る', sections }: ReviewGuideProps) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type={titleType} style={styles.title}>{title}</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}の説明を${open ? '閉じる' : '開く'}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((value) => !value)}
          style={styles.button}>
          <ThemedText type="small" themeColor="sleepInk" style={styles.link}>
            {open ? '閉じる' : openLabel}
          </ThemedText>
        </Pressable>
      </View>
      {open && (
        <ThemedView type="backgroundElement" style={[styles.content, { borderColor: theme.line }]}>
          {sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <ThemedText type="smallBold">{section.heading}</ThemedText>
              {section.paragraphs.map((paragraph) => (
                <ThemedText key={paragraph} type="small">{paragraph}</ThemedText>
              ))}
            </View>
          ))}
        </ThemedView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  title: { flex: 1, minWidth: 0 },
  button: { minHeight: 44, flexShrink: 0, justifyContent: 'center', paddingHorizontal: Spacing.one },
  link: { textDecorationLine: 'underline' },
  content: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  section: { gap: Spacing.one },
});
