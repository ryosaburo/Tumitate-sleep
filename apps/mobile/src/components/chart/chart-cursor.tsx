import type { SimDay } from '@nekase/core';
import { chartTop } from '@nekase/core';
import { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { H2, L, PW, VIEW_H, xo, Y0, Y2, ya } from './geometry';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** 日付カーソルと、下の「◯日目」の札。選んだ日が変わるたびに、ここだけが描き直される。 */
export function ChartCursor({ sim, day, c }: { sim: readonly SimDay[]; day: number; c: Palette }) {
  const { top } = chartTop(sim);
  const x = xo(day);
  const cur = sim[day - 1];
  const px = Math.min(L + PW - 38, Math.max(2, x - 20));
  return (
    <G>
      <Line x1={x} x2={x} y1={Y0} y2={Y2 + H2} stroke={c.text} strokeWidth={1.2} strokeDasharray="3 2" />
      {cur && <Circle cx={x} cy={ya(cur.value, top)} r={4.5} fill={c.backgroundElement} stroke={c.text} strokeWidth={2} />}
      {[1, 7, 14, 21, 28].map((d) => (
        <SvgText key={d} x={xo(d)} y={342} fontSize={10} textAnchor="middle" fill={c.textSecondary}>
          {d}
        </SvgText>
      ))}
      <Rect x={px} y={VIEW_H - 22} width={40} height={16} rx={8} fill={c.text} />
      <SvgText x={px + 20} y={VIEW_H - 10.5} fontSize={10} fontWeight="700" textAnchor="middle" fill={c.background}>
        {day}日目
      </SvgText>
    </G>
  );
}
