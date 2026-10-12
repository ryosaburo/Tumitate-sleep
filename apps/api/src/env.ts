export interface Bindings {
  DB: D1Database;
}

/** 認証を通ったあとに、ルートが使える値 */
export interface Variables {
  accountId: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
