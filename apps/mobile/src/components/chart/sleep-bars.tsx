import { clock, SPAN, TOL, type DayRecord } from '@nekase/core';
import { memo } from 'react';
import { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { L, PW, TICKS, Y0, ys, xo, Y2, H2 } from './geometry';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

interface Props {
  records: readonly (DayRecord | null)[];
  elapsed: number;
  targetBed: number;
  targetWake: number;
  c: Palette;
}

const clampM = (m: number): number => Math.min(SPAN, Math.max(0, m));

/** 上段: 就寝〜起床の棒と、目標時刻の帯。帯の外の棒は、薄い塗り+枠線で区別する。 */
export const SleepBars = memo(function SleepBars({ records, elapsed, targetBed, targetWake, c }: Props) {
  const band = (t: number) => {
    const y1 = ys(clampM(t - TOL));
    return <Rect key={t} x={L} y={y1} width={PW} height={ys(clampM(t + TOL)) - y1} fill={c.backgroundSelected} opacity={0.7} />;
  };
  return (
    <G>
      <SvgText x={L} y={12} fontSize={10} fontWeight="700" fill={c.textSecondary}>
        睡眠(就寝 → 起床)
      </SvgText>
      {band(targetBed)}
      {band(targetWake)}
      {TICKS.map((t) => (
        <G key={t}>
          <Line x1={L} x2={L + PW} y1={ys(t)} y2={ys(t)} stroke={c.line} strokeWidth={1} />
          <SvgText x={L - 6} y={ys(t) + 3.5} fontSize={10} textAnchor="end" fill={c.textSecondary}>
            {clock(t)}
          </SvgText>
        </G>
      ))}
      {[7, 14, 21, 28].map((d) => (
        <Line key={d} x1={L + (d / 30) * PW} x2={L + (d / 30) * PW} y1={Y0} y2={Y2 + H2} stroke={c.line} strokeDasharray="2 3" />
      ))}
      {records.slice(0, elapsed).map((d, i) => {
        if (!d || d.bed == null || d.wake == null) return null;
        const kept = Math.abs(d.bed - targetBed) <= TOL;
        const y = ys(d.bed);
        return (
          <Rect
            key={i}
            x={xo(i + 1) - 3.2}
            y={y}
            width={6.4}
            height={Math.max(2, ys(d.wake) - y)}
            rx={3.2}
            fill={kept ? c.sleep : c.background}
            stroke={c.sleep}
            strokeWidth={kept ? 0 : 1.4}
            opacity={kept ? 1 : 0.85}
          />
        );
      })}
    </G>
  );
});
