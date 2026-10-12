-- ねかせ API の初期スキーマ(計画書 §8.3)。
-- 計画書との違い:
--   * 各表に synced_at(サーバーが受け取った時刻)を足した。
--     updated_at は競合の判定(あとから更新した方)に、synced_at は「since より後に届いた変更」の取得に使う。
--     端末が圏外で編集し、あとで同期した行を、他の端末が取りこぼさないため。
--   * rate_limits を足した(引き継ぎコードの試行回数の制限)。

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE records (
  account_id TEXT NOT NULL,
  date TEXT NOT NULL,                 -- 'YYYY-MM-DD'(起床日)
  bed_min INTEGER,                    -- 20:00 起点の分。未記録は NULL
  wake_min INTEGER,
  screen INTEGER NOT NULL DEFAULT 0,
  caffeine INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, date)
);
CREATE INDEX records_synced ON records (account_id, synced_at);

CREATE TABLE settings (
  account_id TEXT PRIMARY KEY,
  target_bed TEXT NOT NULL,
  target_wake TEXT NOT NULL,
  start_date TEXT,
  tasks_json TEXT NOT NULL,
  preset TEXT NOT NULL,
  pending_bed_ts INTEGER,             -- 「ねる」を押した時刻。未押下は NULL
  updated_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL
);

CREATE TABLE link_codes (
  code_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE fx_trades (
  account_id TEXT NOT NULL,
  id TEXT NOT NULL,
  date TEXT NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  notional INTEGER NOT NULL,
  entry_rate REAL NOT NULL,
  stop_rate REAL NOT NULL,
  exit_rate REAL,
  exit_reason TEXT,
  pnl INTEGER,
  gauge INTEGER,
  reason TEXT,
  settled_at INTEGER,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, id)
);
CREATE INDEX fx_trades_synced ON fx_trades (account_id, synced_at);

CREATE TABLE fx_ledger (
  account_id TEXT NOT NULL,
  id TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- 'grant' | 'pnl'
  amount INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, id)
);
CREATE INDEX fx_ledger_synced ON fx_ledger (account_id, synced_at);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,                  -- 例: 'redeem:<IP>'
  at INTEGER NOT NULL
);
CREATE INDEX rate_limits_key ON rate_limits (key, at);
