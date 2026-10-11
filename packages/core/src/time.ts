/** 時刻の軸は 20:00 を 0 分とする(計画書 §5)。 */
export const OFF = 1200;
/** 表示範囲は 20:00〜12:00 の 960 分。 */
export const SPAN = 960;

/** 時刻(時・分)を、20:00 起点の分に変換する。24 時をまたぐ分は翌日側に寄せる。 */
export function toAxisMinutes(hour: number, minute: number): number {
  const total = hour * 60 + minute;
  return total >= OFF ? total - OFF : total + 1440 - OFF;
}
