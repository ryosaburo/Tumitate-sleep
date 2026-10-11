/**
 * 端末内保存の行の形。計画書 §8.3 の D1 と同じキー名(account_id は端末内では不要なので省く)。
 * 時刻は 20:00 起点の分、updated_at はミリ秒(「あとから更新した方」を選ぶのに使う)。
 */
export interface RecordRow {
  /** 起床日 'YYYY-MM-DD' */
  date: string;
  bed_min: number | null;
  wake_min: number | null;
  /** 0 または 1 */
  screen: 0 | 1;
  caffeine: 0 | 1;
  updated_at: number;
}

export interface SettingsRow {
  /** 'HH:MM' */
  target_bed: string;
  target_wake: string;
  /** 開始日 'YYYY-MM-DD'。未開始は null */
  start_date: string | null;
  /** 選んだ課題の JSON 配列。例: '["bed","screen","caffeine"]' */
  tasks_json: string;
  /** 'safe' | 'bal' | 'grow' */
  preset: string;
  /** 「ねる」を押した時刻(ミリ秒)。押していなければ null */
  pending_bed_ts: number | null;
  updated_at: number;
}

/**
 * 端末内保存の共通インターフェース。Web は localStorage、ネイティブは SQLite。
 * 現在時刻は呼び出し側が updated_at に入れて渡す(保存層は時計を持たない)。
 * 読み込みに失敗しても例外は投げず、空として扱って警告を出す。
 */
export interface Storage {
  /** 保存データを実際に残せるか(ブラウザの保存が使えないときは false。その場合はメモリ上のみ) */
  readonly persistent: boolean;
  /** 日付の昇順 */
  getRecords(): Promise<RecordRow[]>;
  getRecord(date: string): Promise<RecordRow | null>;
  /** 同じ日付があれば上書きする */
  putRecord(row: RecordRow): Promise<void>;
  /** 保存がなければ null */
  getSettings(): Promise<SettingsRow | null>;
  putSettings(row: SettingsRow): Promise<void>;
  /** 「ねる」の途中状態(pending_bed_ts)。設定がなければ既定値から作って保存する */
  getPendingBed(): Promise<number | null>;
  setPendingBed(ts: number | null, now: number): Promise<void>;
  /** 端末内の全データを消す(設定のリセット用) */
  clear(): Promise<void>;
}
