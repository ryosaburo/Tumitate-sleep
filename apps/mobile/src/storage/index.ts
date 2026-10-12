// ネイティブ(iOS / Android)用。Web では index.web.ts が使われる(Metro の拡張子による切り替え)。
export type { RecordRow, SettingsRow, Storage } from "./types";
export { newer, defaultSettings } from "./common";
import { createNativeStorage } from "./native";
import type { Storage } from "./types";

export function createStorage(): Storage {
  return createNativeStorage();
}
