-- 引き継ぎコードで 2 台目の端末をつなぐとき、1 台目のトークンを無効にしないため、
-- アカウントに複数のトークン(のハッシュ)を持てるようにする。
-- accounts.token_hash は、アカウント作成時の最初のトークン用として、そのまま使う。

CREATE TABLE account_tokens (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX account_tokens_account ON account_tokens (account_id);

-- 引き継ぎコードを出し直すとき、そのアカウントの未使用のコードを探すための索引
CREATE INDEX link_codes_account ON link_codes (account_id);
