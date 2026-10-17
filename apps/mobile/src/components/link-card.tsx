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
  const [guideOpen, setGuideOpen] = useState(false);
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
      <View style={styles.heading}>
        <ThemedText type="smallBold" style={styles.headingTitle}>ほかの端末に引き継ぐ</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={guideOpen ? '端末引き継ぎの説明を閉じる' : '端末引き継ぎの説明を詳しく見る'}
          accessibilityState={{ expanded: guideOpen }}
          onPress={() => setGuideOpen((open) => !open)}
          style={styles.guideButton}>
          <ThemedText type="small" themeColor="sleepInk" style={styles.underline}>
            {guideOpen ? '閉じる' : '詳しく見る'}
          </ThemedText>
        </Pressable>
      </View>
      {guideOpen && (
        <View style={styles.guide}>
          <View style={styles.guideSection}>
            <ThemedText type="smallBold">ほかの端末への引き継ぎとは？</ThemedText>
            <ThemedText type="small">睡眠記録や設定を、別の端末でも利用できるようにする機能です。引き継ぎ後も元の端末を利用できます。</ThemedText>
          </View>
          <View style={styles.guideSection}>
            <ThemedText type="smallBold">引き継ぎ方法</ThemedText>
            <ThemedText type="small">1. 元の端末で同期状況を確認し、コードを発行します。</ThemedText>
            <ThemedText type="small">2. 新しい端末でコードを入力します。</ThemedText>
            <ThemedText type="small">3. 睡眠記録がある場合は「統合」または「上書き」を選択します。</ThemedText>
            <ThemedText type="small">4. 引き継ぎ後、記録や設定が反映されていることを確認します。</ThemedText>
          </View>
          <View style={styles.guideSection}>
            <ThemedText type="smallBold">統合と上書きの違い</ThemedText>
            <ThemedText type="smallBold">統合：</ThemedText>
            <ThemedText type="small">両方の端末の睡眠記録をまとめます。同じ日付の記録は更新時刻が新しいものを優先します。設定は更新時刻が新しい方の設定一式を採用します。</ThemedText>
            <ThemedText type="smallBold">上書き：</ThemedText>
            <ThemedText type="small">引き継ぎ先のデータを削除して、元のアカウントの記録や設定を取り込みます。</ThemedText>
          </View>
          <View style={[styles.warning, { borderColor: theme.assetInk }]}>
            <ThemedText type="smallBold" themeColor="assetInk">注意：</ThemedText>
            <ThemedText type="smallBold" themeColor="assetInk">上書きすると、引き継ぎ先のFX注文も削除されます。</ThemedText>
            <ThemedText type="smallBold" themeColor="assetInk">睡眠記録がない端末では、自動的に上書きされます。設定やFX注文だけがある場合も注意が必要です。</ThemedText>
          </View>
          <View style={styles.guideSection}>
            <ThemedText type="smallBold">引き継ぎコードについて</ThemedText>
            <ThemedText type="small">コードは英数字8文字で、有効期限は発行から10分間です。使用できるのは1回だけで、新しいコードを発行すると古いコードは無効になります。</ThemedText>
            <ThemedText type="small">コードの確認後に操作を中止した場合も、元の端末で再発行が必要です。</ThemedText>
            <ThemedText type="small">コードの発行・入力・同期にはインターネット接続が必要です。コードは引き継ぐ相手以外に共有しないでください。</ThemedText>
          </View>
          <View style={styles.guideSection}>
            <ThemedText type="smallBold">FX取引記録について</ThemedText>
            <ThemedText type="small">現在、FX取引記録は端末間で同期されません。引き継ぎ先にはFXの取引記録が移らないため、注意してください。</ThemedText>
          </View>
        </View>
      )}
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
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  headingTitle: { flex: 1, minWidth: 0 },
  guideButton: { minHeight: 44, flexShrink: 0, justifyContent: 'center', paddingHorizontal: Spacing.one },
  guide: { gap: Spacing.three, paddingVertical: Spacing.two },
  guideSection: { gap: Spacing.one },
  warning: { borderWidth: 2, borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.two },
  gap: { gap: Spacing.two },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 18, letterSpacing: 2 },
  button: { minHeight: 48, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  codeBox: { borderWidth: 2, borderRadius: Spacing.three, padding: Spacing.three, alignItems: 'center', gap: Spacing.one },
  code: { fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: 4 },
  link: { minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
