import { FX_RATES, daysBetween, type FxTrade } from '@nekase/core';
import { View } from 'react-native';
import Svg, { Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

const W = 320;
const H = 150;
const PAD = { l: 38, r: 10, t: 10, b: 20 };
const LO = Math.floor(Math.min(...FX_RATES)) - 1;
const HI = Math.ceil(Math.max(...FX_RATES)) + 1;
const x = (i: number) => PAD.l + (i / (FX_RATES.length - 1)) * (W - PAD.l - PAD.r);
const y = (r: number) => PAD.t + ((HI - r) / (HI - LO)) * (H - PAD.t - PAD.b);

interface Props {
  startDate: string;
  /** 今日(0 始まり)。これより先のレートは描かない */
  dayIndex: number;
  trades: readonly FxTrade[];
}

/** 仮想 USD/JPY の日足(終値)。今日までだけを描く。取引した日に、買い ▲ / 売り ▼ を重ねる。 */
export function RateChart({ startDate, dayIndex, trades }: Props) {
  const c = useTheme();
  const last = Math.min(dayIndex, FX_RATES.length - 1);
  const pts = FX_RATES.slice(0, last + 1)
    .map((r, i) => `${x(i)},${y(r)}`)
    .join(' ');
  const ticks = [LO + 1, Math.round((LO + HI) / 2), HI - 1];

  return (
    <View
      accessible
      accessibilityLabel={`仮想の USD/JPY の日足。今日は ${FX_RATES[last]!.toFixed(2)} 円。取引した日には、買いは上向き、売りは下向きの三角を付けています。`}
      style={{ width: '100%', maxWidth: 560, aspectRatio: W / H }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {ticks.map((t) => (
          <Line key={t} x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={c.line} strokeWidth={1} />
        ))}
        {ticks.map((t) => (
          <SvgText key={`l${t}`} x={PAD.l - 4} y={y(t) + 3} fontSize={10} fill={c.textSecondary} textAnchor="end">
            {t}
          </SvgText>
        ))}
        <SvgText x={PAD.l} y={H - 5} fontSize={10} fill={c.textSecondary}>
          1日目
        </SvgText>
        <SvgText x={W - PAD.r} y={H - 5} fontSize={10} fill={c.textSecondary} textAnchor="end">
          30日目
        </SvgText>
        <Polyline points={pts} fill="none" stroke={c.sleep} strokeWidth={2} />
        {trades.map((t) => {
          const i = daysBetween(startDate, t.date);
          if (i < 0 || i > last) return null;
          const cx = x(i);
          const cy = y(FX_RATES[i]!);
          const up = t.side === 'buy';
          const p = up
            ? `${cx},${cy - 11} ${cx - 5},${cy - 2} ${cx + 5},${cy - 2}`
            : `${cx},${cy + 11} ${cx - 5},${cy + 2} ${cx + 5},${cy + 2}`;
          return <Polygon key={t.date} points={p} fill={c.assetL2} stroke={c.assetL3} strokeWidth={1} />;
        })}
        <Line x1={x(last)} x2={x(last)} y1={PAD.t} y2={H - PAD.b} stroke={c.sleepInk} strokeWidth={1} strokeDasharray="3 3" />
      </Svg>
    </View>
  );
}
