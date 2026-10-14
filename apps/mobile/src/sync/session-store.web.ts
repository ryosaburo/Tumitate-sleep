import { memoryKeyValue, SESSION_KEY, webSessionStore } from "./session-common";
import type { SessionStore } from "./types";

/** Web 版: localStorage に保存する。使えないときは、このタブの間だけメモリに持つ。 */
export function createSessionStore(): SessionStore {
  try {
    const ls = globalThis.localStorage;
    ls.getItem(SESSION_KEY); // 使えない環境ではここで例外になる
    return webSessionStore(ls);
  } catch {
    return webSessionStore(memoryKeyValue());
  }
}
