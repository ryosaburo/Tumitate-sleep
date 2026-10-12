import { SPAN } from '@nekase/core';

/** 二段グラフの座標(viewBox の単位)。上段が睡眠、下段が資産。プロトタイプと同じ寸法。 */
export const W = 360;
export const L = 40;
export const PW = 312;
export const Y0 = 20;
export const H1 = 168;
export const Y2 = 228;
export const H2 = 96;
export const VIEW_H = 372;
export const DAYS = 30;
/** 縦軸の目盛り(20:00 起点の分)。22:00〜10:00 を 2 時間おき */
export const TICKS = [120, 240, 360, 480, 600, 720, 840];

const clamp = (m: number): number => Math.min(SPAN, Math.max(0, m));

/** d 日目(1 始まり)の x 座標 */
export const xo = (d: number): number => L + ((d - 0.5) / DAYS) * PW;
/** 20:00 起点の分 → 上段の y 座標 */
export const ys = (m: number): number => Y0 + (clamp(m) / SPAN) * H1;
/** 金額 → 下段の y 座標 */
export const ya = (v: number, top: number): number => Y2 + H2 - (v / top) * H2;

/** グラフ上の x 座標(viewBox の単位)から、日(1〜elapsed)を求める。スクラブ用。 */
export function dayFromX(x: number, elapsed: number): number {
  const d = Math.round(((x - L) / PW) * DAYS + 0.5);
  return Math.min(Math.max(d, 1), Math.max(elapsed, 1));
}

export const f1 = (n: number): string => n.toFixed(1);

/** 上の線 hi と下の線 lo で挟んだ帯の Path。pts は 1 日目から。 */
export function bandPath<T>(
  pts: readonly T[],
  hi: (p: T) => number,
  lo: (p: T) => number,
  top: number,
): string {
  if (pts.length === 0) return '';
  const up = pts.map((q, k) => `${k ? 'L' : 'M'}${f1(xo(k + 1))} ${f1(ya(hi(q), top))}`).join(' ');
  const down = pts
    .map((_, k) => {
      const j = pts.length - 1 - k;
      return `L${f1(xo(j + 1))} ${f1(ya(lo(pts[j]!), top))}`;
    })
    .join(' ');
  return `${up} ${down} Z`;
}

/** 折れ線の Path */
export function linePath<T>(pts: readonly T[], v: (p: T) => number, top: number): string {
  return pts.map((q, k) => `${k ? 'L' : 'M'}${f1(xo(k + 1))} ${f1(ya(v(q), top))}`).join(' ');
}

export const yen = (n: number): string => `¥${Math.round(n).toLocaleString('ja-JP')}`;
/** 縦軸の目盛りの表記(万円) */
export const man = (v: number): string =>
  v === 0 ? '0' : v >= 10000 ? `${+(v / 10000).toFixed(1)}万` : v.toLocaleString('ja-JP');
