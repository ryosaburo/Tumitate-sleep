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

## しくみ(どう動いているか)

大きく3つの部品が、次のように動きます。

```
 iPhone / PC のブラウザ                       Cloudflare
┌──────────────────────────┐   HTTPS    ┌──────────────────────────┐
│ apps/mobile(アプリ)      │ ─────────▶ │ apps/api(Workers + Hono) │
│  ・「ねる」「おきた」を記録  │   同期     │  ・アカウント作成・認証     │
│  ・端末内に保存(まず手元に) │ ◀───────── │  ・記録の同期・引き継ぎ     │
│  ・packages/core で計算     │            │        │                 │
└──────────────────────────┘            │        ▼                 │
                                         │   D1(SQLite のデータベース)│
                                         └──────────────────────────┘
```

- **まず端末の中に保存します。** 記録はブラウザ(Web)または SQLite(ネイティブ)に保存します。ネットワークがなくても記録できます。
- **計算は `packages/core` が担当します。** 積立額、評価額、複利の分、判定は、すべてここで計算します。アプリと API が同じ計算を使います。
- **API は「端末どうしをつなぐ」だけです。** 匿名アカウントを作り、記録を同期し、引き継ぎコードで別の端末に同じ記録を渡します。計算や判定は API では行いません。
- **アカウントは匿名です。** メールアドレスやパスワードは使いません。アカウント作成時に、ランダムなトークンを 1 回だけ端末に渡します。サーバーに保存するのは、そのトークンの**ハッシュだけ**です。2 台目をつなぐときは、引き継ぎコードと引き換えに、その端末用の新しいトークンを渡します(1 台目はそのまま使えます)。
- **競合したら、あとから更新した方を残します。** 同じ日の記録を 2 台で変えたときは、行ごとに新しい方を採用します。
- **サーバーに置くのは、日付・時刻・チェックの有無・取引の記録だけです。** 睡眠の音声やセンサーのデータは扱いません。

### API の状況

| エンドポイント | 内容 | 状況 |
| --- | --- | --- |
| `GET /health` | 動作確認 | 実装済み |
| `POST /v1/accounts` | 匿名アカウントを作り、`{accountId, token}` を返す | 実装済み |
| `POST /v1/sync` | `{since, changes}` を送り、`{serverTime, changes}` を受け取る。記録・設定・FX の取引・台帳を同期する | 実装済み |
| `POST /v1/link/start` / `POST /v1/link/redeem` | 引き継ぎコード(8 文字、10 分、1 回限り)の発行と引き換え。引き換えは、同じ送信元から 10 分に 5 回まで | 実装済み |
| `DELETE /v1/account` | アカウントと全データ(引き継ぎのトークンとコードを含む)を削除する。元に戻せない | 実装済み |

認証が必要な API は、`Authorization: Bearer <accountId>.<token>` のヘッダーを付けます。エラーは `{ "error": { "code": "...", "message": "..." } }` の形で返します。

## Cloudflare の動かし方(API と D1)

API は Cloudflare Workers の上で動き、データは D1(SQLite)に入ります。D1 のスキーマは `apps/api/migrations/` のファイルで管理します(**既存のファイルは書き換えず、新しいファイルを足します**)。

### 手元(ローカル)で動かす

Cloudflare のアカウントは要りません。

```sh
cd apps/api
pnpm exec wrangler d1 migrations apply nekase --local   # ローカルの D1 にテーブルを作る(最初の1回と、マイグレーションを足したとき)
pnpm dev                                                # http://localhost:8787 で起動
```

別のターミナルで、動作を確かめます。

```sh
curl http://localhost:8787/health                  # {"ok":true}
curl -X POST http://localhost:8787/v1/accounts     # {"accountId":"...","token":"..."}
```

- ローカルの D1 のデータは `apps/api/.wrangler/` に入ります(Git には入りません)。消すと、まっさらな状態に戻ります。
- シークレットが必要になったら `apps/api/.dev.vars` に書きます。**コミットしません。**

### テスト

```sh
pnpm -F api test
```

API のテストは、Node 22 の `node:sqlite` で作った D1 もどき(`apps/api/src/testing/d1.ts`)の上で動きます。**Node 22 以上が必要です**(`nvm use`)。本物の D1 と Workers での確認は、デプロイ後に行います。

### Web 版も一緒に動かす(ローカル)

API の Worker は、Web 版(静的ファイル)も配信します。`/v1/*` と `/health` は Hono の API が、それ以外は静的ファイルが返ります(存在しないパスは `index.html`)。

```sh
pnpm build:web              # apps/mobile を書き出して apps/mobile/dist を作る(Expo の Web 出力)
pnpm -F api dev             # http://localhost:8787 で、画面と API が同じ場所で動く
```

`pnpm -F api dev` だけでも動きます(`dist` がなければ空のフォルダーを作ります。そのときは画面は出ず、API だけ動きます)。画面の開発中は、これまでどおり `pnpm -F mobile web` を使うのが速いです。

### 同期を試す(ローカル)

アプリは、開いたときと記録を変えたときに、API と同期します。通信できなくても、端末内には保存されます。

- 本番の Web 版は、画面と API が同じ URL なので、設定は要りません。
- `pnpm -F mobile web`(画面)と `pnpm -F api dev`(API)を別々に動かすときは、画面の側に API の場所を教えます。

```
EXPO_PUBLIC_API_URL=http://localhost:8787 pnpm -F mobile web
```

- ネイティブ(iPhone など)では、公開 URL を指定します。例: `EXPO_PUBLIC_API_URL=https://nekase.<サブドメイン>.workers.dev`
- 引き継ぎは、設定の「ほかの端末に引き継ぐ」から行います(1台目でコードを発行し、2台目で入力)。

### 公開する(Cloudflare へのデプロイ)

公開は 1 つの Worker(`nekase`)で、画面と API を同じ URL から配信します。**初回だけ**、次を行います。

```sh
cd apps/api
pnpm exec wrangler login                                    # ① ブラウザで Cloudflare にログイン(自分でやる)
pnpm exec wrangler d1 create nekase                         # ② 本番の D1 を作る。表示された database_id を、wrangler.toml の database_id に書く
pnpm exec wrangler d1 migrations apply nekase --remote      # ③ 本番の D1 にテーブルを作る
cd ../..
pnpm run deploy                                             # ④ Web 版を書き出し、Worker をデプロイ
```

- ④ の最後に、公開 URL(`https://nekase.<サブドメイン>.workers.dev`)が表示されます。
- **`pnpm deploy` ではなく `pnpm run deploy`** と書きます(`pnpm deploy` は、pnpm 自身の別のコマンドです)。
- `wrangler.toml` の `database_id` は、自分の D1 の値です。Cloudflare のアカウント ID と合わせて、**チャットや Pull Request に貼りません。**
- 設定を変えるのは `apps/api/wrangler.toml` です。画面の書き出し先(`apps/mobile/dist`)は Git に入りません。

### 再デプロイする(2 回目以降)

コードや画面を変えたあとに、公開 URL へ反映する手順です。初回の ①② は、もう済んでいるので要りません。

**① 反映したい内容を、手元に持ってくる**

デプロイは「いま手元にあるコード」を公開します。Pull Request をマージしたあと、手元を最新にしてから行います。

```sh
git checkout main        # 公開する内容を入れたブランチ(チームで決めたもの)。dev でも main でもよい
git pull
pnpm install             # 依存が変わっていることがあるので、毎回やっておく
```

**② 公開前の確認(1 分)**

```sh
pnpm check               # 型チェック + lint + テスト。落ちたら、デプロイしない
```

**③ 本番の D1 にマイグレーションを反映する(`apps/api/migrations/` に新しいファイルがあるときだけ)**

```sh
cd apps/api
pnpm exec wrangler d1 migrations list nekase --remote    # まだ反映していないファイルが表示される(「No migrations to apply」なら、何もしなくてよい)
pnpm exec wrangler d1 migrations apply nekase --remote   # 反映する(Y/N を聞かれたら、内容を見て Y)
cd ../..
```

- **先に ③、あとに ④** の順です。新しいコードが、まだない表を使うと、API がエラーになります。
- マイグレーションは足すだけで、書き換えません。反映したものは、取り消せません。

**④ デプロイする**

```sh
pnpm run deploy          # Web 版を書き出して、Worker をデプロイする(1 〜 2 分)
```

- ログインが切れていたら `cd apps/api && pnpm exec wrangler login` をしてから、もう一度行います。
- 最後に公開 URL が表示されます。

**⑤ 公開後の確認**

```sh
curl https://nekase.<サブドメイン>.workers.dev/health                # {"ok":true}
curl -X POST https://nekase.<サブドメイン>.workers.dev/v1/accounts   # {"accountId":"...","token":"..."}
```

- ブラウザで URL を開き、**強く再読み込み**(Mac: `Cmd + Shift + R`)して、変えた画面が出ることを見ます。古い画面が出るときは、ブラウザのキャッシュです。
- 「ねる」「おきた」を押して、同期のエラーが出ないことも見ます。

**うまくいかないとき**

| 症状 | 見るところ |
| --- | --- |
| `pnpm run deploy` が途中で失敗する | 最初の `build:web`(画面の書き出し)か、`wrangler deploy` か、どちらで止まったかを見る。エラーの全文を残す |
| 画面は新しいが、API がエラーになる | ③ を忘れていないか(`migrations list` で確認) |
| 反映したのに、画面が古い | 強く再読み込み。それでも古いなら、`apps/mobile/dist` が更新されたか(`pnpm build:web` を単独で実行)を見る |
| 公開した内容を戻したい | Cloudflare のダッシュボード → Workers & Pages → `nekase` → Deployments から、前のバージョンに戻せる(D1 のマイグレーションは戻らない) |
| ログを見たい | `cd apps/api && pnpm exec wrangler tail`(リアルタイムのログ。止めるときは `Ctrl + C`) |

**AI(「AI にまかせる」)について**

- Workers AI は `wrangler.toml` の `[ai]` で有効です。無料プランのままなら、無料枠を超えた分は課金ではなくエラーになります(費用の方針は計画書 §6.6)。
- **緊急で止めたいとき:** `wrangler.toml` に `[vars]` と `AI_DISABLED = "1"` を足して、④ を行います。AI を呼ばなくなります。
- 使用量は、Cloudflare のダッシュボード(Workers AI の利用状況)で見られます。

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
pnpm -F api dev             # API をローカル起動(http://localhost:8787/health)。初回は先に D1 の準備が必要(下の「Cloudflare の動かし方」)
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
