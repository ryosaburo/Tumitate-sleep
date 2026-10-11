# ねかせ(nekase)

> 眠る習慣が、仮想の資産を育てる。

睡眠改善アプリです。「ねる」「おきた」ボタンで睡眠を記録し、決めた行動(就寝・起床・画面を見ない・カフェインを控える)を守ると、仮想の積立資産が育ちます。ハッカソン(2週間・3人)のデモ用に作っています。

> ⚠️ **学習用のシミュレーションです。実際の売買や換金はできません。**
> 睡眠時間は「推定値」です。医療上のアドバイスや診断ではありません。

## 特徴

- **機器なしで記録**: ボタンを押すだけ。HealthKit は任意で、後回しです。
- **報酬は行動に付く**: 睡眠の結果(時間やスコア)ではなく、行動を守ったことに報酬が付きます。できなかった日は積立が止まるだけで、資産は減りません。
- **PC とスマホで引き継ぎ**: 匿名アカウントと引き継ぎコードで、同じ記録を使えます。
- **FX 的なチャレンジ(任意)**: 仮想の資金で判断の練習ができます。損切り必須、レバレッジなし、夜間ロックなど、睡眠を守る安全装置つきです。
- **おやすみ画面**: 「ねる」を押すと、資産や通知を出さない暗い画面になります。

## 技術構成

pnpm ワークスペースです。

| 場所 | 内容 |
| --- | --- |
| `apps/mobile` | Expo(React Native)+ TypeScript、Expo Router。Web 出力を含む |
| `apps/api` | Cloudflare Workers + Hono + Zod + D1 |
| `packages/core` | 計算ロジック(積立、複利の分解、判断力ゲージ、FX の損益など)。アプリと API の両方が使う |

> 現在は雛形ができた段階です(画面と計算ロジックはこれから作ります)。

## ドキュメント

- [`docs/nekase-plan.md`](docs/nekase-plan.md): 計画書。**仕様の正**です。
- [`docs/claude-code-prompts.md`](docs/claude-code-prompts.md): 段階ごとの Claude Code への依頼文。
- [`docs/prototype/nekase.html`](docs/prototype/nekase.html): Web のプロトタイプ(単一ファイル)。ロジックと見た目の見本です。ブラウザで開くと動きます。
- [`CLAUDE.md`](CLAUDE.md): Claude Code 用のプロジェクト指示。

## 開発の始め方

Node.js 22 以上が必要です(`nvm use` で `.nvmrc` の版に切り替えられます)。

```sh
corepack enable             # pnpm を使えるようにする(最初の1回)
pnpm install
pnpm -F @nekase/core test   # 計算ロジックのテスト
pnpm -F mobile web          # Web 版を起動
pnpm -F api dev             # API をローカル起動(http://localhost:8787/health)
pnpm check                  # 型チェック + lint + テスト
```

## 進め方のルール

- `main` に直接コミットしません。ブランチを切って Pull Request を出します。
- 計算ロジックは `packages/core` に書き、テストも一緒に書きます。
- 変更したら `typecheck` と `test` を通してから出します。
- シークレット(`.env`、`.dev.vars` など)はコミットしません。

詳しくは [`CLAUDE.md`](CLAUDE.md) を見てください。

## 公開

ストアには公開しません。Cloudflare にデプロイして、URL で見せます。
