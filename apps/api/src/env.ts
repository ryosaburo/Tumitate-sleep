export interface Bindings {
  DB: D1Database;
  /** Workers AI(計画書 §6.6)。wrangler.toml の [ai] で結びつける */
  AI: Ai;
  /** 使うモデルを入れ替えたいとき(任意)。省略すると既定のモデル */
  AI_MODEL?: string;
}

/** 認証を通ったあとに、ルートが使える値 */
export interface Variables {
  accountId: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
