import { ApiFailure } from "./types";

/** 引き継ぎのエラーを、画面に出す文言にする。原因ごとに、次にやることが分かるようにする。 */
export function linkErrorMessage(e: unknown): string {
  if (!(e instanceof ApiFailure)) return "うまくいきませんでした。もう一度ためしてください。";
  if (e.kind === "network") return "通信できませんでした。ネットワークを確かめて、もう一度ためしてください。";
  switch (e.code) {
    case "invalid_code":
      return "コードが違います。入力を確かめてください。";
    case "code_used":
      return "このコードは、すでに使われました。1台目で、もう一度発行してください。";
    case "code_expired":
      return "コードの有効期限が切れました。1台目で、もう一度発行してください。";
    case "too_many_attempts":
      return "試行回数が多すぎます。10分ほど待ってから、やり直してください。";
    default:
      return "うまくいきませんでした。もう一度ためしてください。";
  }
}

/** 残り時間を「m:ss」で返す。期限を過ぎたら null。 */
export function remaining(expiresAt: number, now: number): string | null {
  const ms = expiresAt - now;
  if (ms <= 0) return null;
  const sec = Math.ceil(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** 8 文字のコードを、読みやすく 4 文字ずつに区切る */
export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
