-- AI による注文の代行(計画書 §6.6)の、1 日あたりの呼び出し回数。
-- アカウントごと・日ごと(日本時間の日付)に、呼び出した回数を数える。上限は AI_DAILY_LIMIT。
CREATE TABLE ai_usage (
  account_id TEXT NOT NULL,
  day TEXT NOT NULL,                  -- 'YYYY-MM-DD'(日本時間)
  n INTEGER NOT NULL,
  PRIMARY KEY (account_id, day)
);
