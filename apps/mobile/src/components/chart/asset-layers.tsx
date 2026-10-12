import { chartTop, type SimDay } from '@nekase/core';
import { memo } from 'react';
import { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { bandPath, H2, L, linePath, man, PW, Y2, ya } from './geometry';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

interface Props {
  /** 30 日分。elapsed 日目までを描く */
  sim: readonly SimDay[];
  elapsed: number;
  /** 下落局面(日。1 始まり)。経過した分だけ帯を描く */
  dip: { peakDay: number; troughDay: number };
  c: Palette;
}

/** 下段: 積立元本 / 運用益 / 複利の分 / 元本割れの積み上げと、評価額の線。 */
export const AssetLayers = memo(function AssetLayers({ sim, elapsed, dip, c }: Props) {
  const { top, step } = chartTop(sim);
  const pts = sim.slice(0, elapsed);
  const t0 = (q: SimDay) => Math.min(q.value, q.principal);
  const t1 = (q: SimDay) => t0(q) + q.g1;
  const t2 = (q: SimDay) => t1(q) + q.comp;
  const tl = (q: SimDay) => t0(q) + q.loss;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);

  const dipEnd = Math.min(dip.troughDay, elapsed);
  const dipX = L + (dip.peakDay / 30) * PW;
  const dipW = ((dipEnd - dip.peakDay) / 30) * PW;

  const d1 = bandPath(pts, t0, () => 0, top);
  const d2 = bandPath(pts, t1, t0, top);
  const d3 = bandPath(pts, t2, t1, top);
  const dl = bandPath(pts, tl, t0, top);
  const anyLoss = pts.some((q) => q.loss > 0);

  return (
    <G>
      <SvgText x={L} y={Y2 - 10} fontSize={10} fontWeight="700" fill={c.textSecondary}>
        仮想の資産(円)
      </SvgText>
      {ticks.map((v) => (
        <G key={v}>
          <Line x1={L} x2={L + PW} y1={ya(v, top)} y2={ya(v, top)} stroke={c.line} strokeWidth={1} />
          <SvgText x={L - 6} y={ya(v, top) + 3.5} fontSize={10} textAnchor="end" fill={c.textSecondary}>
            {man(v)}
          </SvgText>
        </G>
      ))}
      {dipW > 0 && (
        <G>
          <Rect x={dipX} y={Y2 - 4} width={dipW} height={H2 + 4} fill={c.assetSoft} opacity={0.6} />
          <SvgText x={dipX + dipW / 2} y={Y2 + 9} fontSize={9} fontWeight="700" textAnchor="middle" fill={c.assetInk}>
            下落局面
          </SvgText>
        </G>
      )}
      {pts.length > 0 && (
        <G>
          <Path d={d1} fill={c.assetL1} />
          <Path d={d2} fill={c.assetL2} />
          <Path d={d2} fill="url(#hatch-gain)" />
          <Path d={d3} fill={c.assetL3} />
          <Path d={d3} fill="url(#hatch-comp)" />
          {anyLoss && <Path d={dl} fill="url(#hatch-loss)" />}
          <Path d={linePath(pts, (q) => q.value, top)} fill="none" stroke={c.text} strokeWidth={1.8} strokeLinejoin="round" />
        </G>
      )}
    </G>
  );
});
