// Web 用。ネイティブでは index.ts が使われる(Metro の拡張子による切り替え)。
export type { FxOrderRow, RecordRow, SettingsRow, Storage } from "./types";
export { newer, defaultSettings } from "./common";
import { createWebStorage } from "./web";
import type { Storage } from "./types";

export function createStorage(): Storage {
  return createWebStorage();
}
