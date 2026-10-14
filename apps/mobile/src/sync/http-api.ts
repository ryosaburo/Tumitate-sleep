import { ApiFailure, type Changes, type Credentials, type LinkCode, type SyncApi, type SyncResponse } from "./types";

/**
 * fetch で API を呼ぶ実装。baseUrl が空なら同じオリジン(本番の Web 版)。
 * ネイティブとローカル開発では、EXPO_PUBLIC_API_URL(例: http://localhost:8787)を渡す。
 */
export function createHttpApi(baseUrl: string, fetchImpl: typeof fetch = fetch): SyncApi {
  const call = async <T>(path: string, init: { auth?: Credentials; body?: unknown; method?: string }): Promise<T> => {
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method: init.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          ...(init.auth ? { Authorization: `Bearer ${init.auth.accountId}.${init.auth.token}` } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new ApiFailure("network");
    }
    if (res.ok) return (await res.json()) as T;
    let code = "";
    let message = "";
    try {
      const e = (await res.json()) as { error?: { code?: string; message?: string } };
      code = e.error?.code ?? "";
      message = e.error?.message ?? "";
    } catch {
      // 本文が JSON でないときは、コードなしで扱う
    }
    throw new ApiFailure(res.status === 401 ? "auth" : "http", code, message);
  };

  return {
    createAccount: () => call<Credentials>("/v1/accounts", {}),
    sync: (auth: Credentials, since: number, changes: Changes): Promise<SyncResponse> =>
      call<SyncResponse>("/v1/sync", { auth, body: { since, changes } }),
    linkStart: (auth: Credentials): Promise<LinkCode> => call<LinkCode>("/v1/link/start", { auth }),
    linkRedeem: (code: string): Promise<Credentials> => call<Credentials>("/v1/link/redeem", { body: { code } }),
  };
}
