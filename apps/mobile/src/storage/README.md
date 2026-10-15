# 端末内保存の層(`src/storage`)

記録・設定・「ねる」の途中状態を、端末の中に保存する。Web とネイティブで、同じ使い方ができる。

## 使い方

```ts
import { createStorage } from "@/storage";

const storage = createStorage(); // アプリで 1 回だけ作る

// 「ねる」を押したとき(now は呼び出し側が渡す。保存層は時計を持たない)
await storage.setPendingBed(Date.now(), Date.now());

// 「おきた」を押したとき
await storage.putRecord({
  date: "2026-10-12", // 起床日
  bed_min: 210, // 20:00 起点の分(23:30 → 210)
  wake_min: 630,
  screen: 1,
  caffeine: 0,
  updated_at: Date.now(),
});
await storage.setPendingBed(null, Date.now());

const records = await storage.getRecords(); // 日付の昇順
const settings = await storage.getSettings(); // なければ null
```

## 仕組み

| ファイル | 役割 |
| --- | --- |
| `types.ts` | `Storage` インターフェースと、行の形(`RecordRow`、`SettingsRow`)。キー名は計画書 §8.3 と同じ |
| `common.ts` | 壊れたデータの検証、設定の既定値、`newer()`(あとから更新した方を選ぶ) |
| `web.ts` | Web 版。localStorage に 1 キー(`nekase.v2`)で JSON 保存。使えないときはメモリ上 |
| `native.ts` | ネイティブ版。expo-sqlite。薄い実装で、実機での確認はまだ |
| `index.ts` / `index.web.ts` | プラットフォームで自動的に切り替わる(Metro の拡張子による選択) |

## 決まり

- 各行に `updated_at`(ミリ秒)を持つ。同期のときは `newer(手元, サーバー)` で、あとから更新した方を残す。
- 読み込みに失敗しても例外は投げない。壊れた行は捨てて、`console.warn` を出す。
- 時刻は 20:00 起点の分(`@nekase/core` の `ax()` で変換する)。
- FX の注文(`fx_orders`)は、決済前の形だけ保存する。決済と資金は core が毎回計算する。
- 以前のプロトタイプの保存(`nekase.v1`)は読まない。

## テスト

```
pnpm -F mobile test
```

Web 版は、メモリ上の疑似 localStorage で試している。ネイティブ版は、テストがまだない。
