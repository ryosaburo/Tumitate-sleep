// ネイティブ(iOS / Android)用。Web では session-store.web.ts が使われる(Metro の拡張子による切り替え)。
import * as SecureStore from "expo-secure-store";
import { parseSession } from "./session-common";
import type { Session, SessionStore } from "./types";

const KEY = "nekase.session.v1";

export function createSessionStore(): SessionStore {
  return {
    async load() {
      try {
        return parseSession(await SecureStore.getItemAsync(KEY));
      } catch {
        return null;
      }
    },
    async save(s: Session) {
      await SecureStore.setItemAsync(KEY, JSON.stringify(s));
    },
    async clear() {
      await SecureStore.deleteItemAsync(KEY);
    },
  };
}
