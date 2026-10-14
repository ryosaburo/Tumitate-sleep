import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNekase } from '@/state/nekase-provider';
import { formatCode, linkErrorMessage, remaining, type Credentials, type LinkCode } from '@/sync';

const STATUS_TEXT = {
  idle: 'まだ同期していません',
  syncing: '同期中…',
  ok: '同期できました',
  offline: '通信できません。この端末には保存されています。つながったら、自動で同期します',
  error: '同期できませんでした。しばらくしてから、もう一度ためしてください',
} as const;

const clockText = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 設定の中の「ほかの端末に引き継ぐ」。発行(1台目)と入力(2台目)の両方を持つ。 */
export function LinkCard() {
  const theme = useTheme();
  const { syncStatus, startLink, redeemLink, applyLink, records } = useNekase();
  const [issued, setIssued] = useState<LinkCode | null>(null);
  const [left, setLeft] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** コードが通ったあと、「上書き / 統合」の確認を待っている認証情報 */
  const [pending, setPending] = useState<Credentials | null>(null);

  // 残り時間を 1 秒ごとに更新する
  useEffect(() => {
    if (!issued) return;
    const tick = () => setLeft(remaining(issued.expiresAt, Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [issued]);

  const issue = async () => {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      setIssued(await startLink());
    } catch (e) {
      setIssued(null);
      setError(linkErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const redeem = async () => {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const creds = await redeemLink(input);
      if (records.length === 0) {
        // 端末内が空なら、確認せずに取り込む
        await applyLink(creds, 'overwrite');
        setDone(true);
        setInput('');
      } else {
        setPending(creds);
      }
    } catch (e) {
      setError(linkErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async (mode: 'overwrite' | 'merge') => {
    if (!pending) return;
    setBusy(true);
    try {
      await applyLink(pending, mode);
      setPending(null);
      setInput('');
      setDone(true);
    } catch {
      setError('取り込めませんでした。もう一度ためしてください。');
    } finally {
      setBusy(false);
    }
  };

  const input_ = [styles.input, { borderColor: theme.line, color: theme.text, backgroundColor: theme.background }];
  const expired = issued !== null && left === null;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.line }]}>
      <ThemedText type="smallBold">ほかの端末に引き継ぐ</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {STATUS_TEXT[syncStatus.state]}
        {syncStatus.lastSyncedAt !== null ? `(最後の同期 ${clockText(syncStatus.lastSyncedAt)})` : ''}
      </ThemedText>

      {error && (
        <ThemedText type="small" style={{ color: theme.assetInk }} accessibilityLiveRegion="polite">
          ⚠ {error}
        </ThemedText>
      )}
      {done && (
        <ThemedText type="small" style={{ color: theme.goodInk }} accessibilityLiveRegion="polite">
          ✓ 引き継ぎました
        </ThemedText>
      )}

      {pending ? (
        <View style={styles.gap}>
          <ThemedText type="smallBold">この端末の記録を、どうしますか?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            コードは使用済みです。やめる場合は、1台目でもう一度発行してください。
          </ThemedText>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => apply('merge')} style={[styles.button, { backgroundColor: theme.sleep }]}>
            <ThemedText type="smallBold" style={{ color: theme.onSleep }}>統合する(両方を残し、新しい方を採用)</ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => apply('overwrite')} style={[styles.button, { borderColor: theme.assetL3, borderWidth: 2 }]}>
            <ThemedText type="smallBold" themeColor="assetInk">上書きする(この端末の記録を消して取り込む)</ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => setPending(null)} style={styles.link}>
            <ThemedText type="small" themeColor="sleepInk" style={styles.underline}>やめる</ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.gap}>
            <ThemedText type="small" themeColor="textSecondary">1台目: 引き継ぎコードを発行します(10分間、1回だけ使えます)</ThemedText>
            {issued && !expired && (
              <View style={[styles.codeBox, { borderColor: theme.sleep }]}>
                <ThemedText selectable style={styles.code} accessibilityLabel={`コード ${issued.code.split('').join(' ')}`}>
                  {formatCode(issued.code)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">残り {left}</ThemedText>
              </View>
            )}
            {expired && <ThemedText type="small" themeColor="textSecondary">有効期限が切れました。もう一度発行してください。</ThemedText>}
            <Pressable accessibilityRole="button" disabled={busy} onPress={issue} style={[styles.button, { backgroundColor: theme.sleep }]}>
              <ThemedText type="smallBold" style={{ color: theme.onSleep }}>{issued && !expired ? 'コードを発行しなおす' : 'コードを発行'}</ThemedText>
            </Pressable>
          </View>

          <View style={styles.gap}>
            <ThemedText type="small" themeColor="textSecondary">2台目: 1台目のコードを入力します</ThemedText>
            <TextInput
              value={input}
              onChangeText={setInput}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              placeholder="ABCD-2345"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="引き継ぎコード"
              style={input_}
            />
            <Pressable accessibilityRole="button" disabled={busy || input.trim() === ''} onPress={redeem} style={[styles.button, { borderColor: theme.sleep, borderWidth: 2 }]}>
              <ThemedText type="smallBold" themeColor="sleepInk">{busy ? '確認中…' : 'このコードで引き継ぐ'}</ThemedText>
            </Pressable>
          </View>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  gap: { gap: Spacing.two },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 18, letterSpacing: 2 },
  button: { minHeight: 48, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  codeBox: { borderWidth: 2, borderRadius: Spacing.three, padding: Spacing.three, alignItems: 'center', gap: Spacing.one },
  code: { fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: 4 },
  link: { minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
