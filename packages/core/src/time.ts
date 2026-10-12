import { OFF } from "./constants";

const pad = (n: number): string => String(n).padStart(2, "0");

/** "23:30" を、20:00 起点の分にする(24 時をまたぐ分は翌日側に寄せる)。 */
export function ax(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return toAxisMinutes(Number(h), Number(m));
}

/** 時・分を、20:00 起点の分にする。 */
export function toAxisMinutes(hour: number, minute: number): number {
  let v = hour * 60 + minute;
  if (v < OFF) v += 1440;
  return v - OFF;
}

/** 20:00 起点の分を、"HH:MM" に戻す。 */
export function clock(axisMin: number): string {
  const v = (axisMin + OFF) % 1440;
  return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`;
}
