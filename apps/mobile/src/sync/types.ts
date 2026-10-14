import type { RecordRow, SettingsRow } from "../storage/types";

/** 端末ごとの同期の状態。トークンは端末にだけ置く(計画書 §8.5)。 */
export interface Session {
  accountId: string;
  token: string;
  /** 次の同期でサーバーに渡す since(前回の serverTime から、少し戻した値) */
  since: number;
  /** ここ以降に更新した行を送る(前回の同期を始めた端末の時刻)。0 なら全部送る */
  pushedAt: number;
}

/** Session の保存先。ネイティブは expo-secure-store、Web はブラウザ保存。 */
export interface SessionStore {
  load(): Promise<Session | null>;
  save(s: Session): Promise<void>;
  clear(): Promise<void>;
}

export interface Credentials {
  accountId: string;
  token: string;
}

export interface Changes {
  records: RecordRow[];
  settings: SettingsRow | null;
}

export interface SyncResponse {
  serverTime: number;
  changes: Changes;
}

export interface LinkCode {
  code: string;
  /** 有効期限(ミリ秒) */
  expiresAt: number;
}

/** 通信の失敗。kind で画面の文言を分ける。 */
export class ApiFailure extends Error {
  constructor(
    readonly kind: "network" | "auth" | "http",
    /** サーバーのエラーコード(invalid_code など)。通信エラーでは空 */
    readonly code: string = "",
    message = "",
  ) {
    super(message || kind);
  }
}

/** サーバーとのやりとり。テストでは差し替える。失敗は ApiFailure を投げる。 */
export interface SyncApi {
  createAccount(): Promise<Credentials>;
  sync(auth: Credentials, since: number, changes: Changes): Promise<SyncResponse>;
  linkStart(auth: Credentials): Promise<LinkCode>;
  linkRedeem(code: string): Promise<Credentials>;
}
