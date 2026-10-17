import { FX_RATES, daysBetween, rateChange, type FxTrade, type RateDirection } from '@nekase/core';
import { View } from 'react-native';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
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
  const change = rateChange(FX_RATES, last);
  const color: Record<RateDirection, string> = { up: c.rateUp, down: c.rateDown, flat: c.textSecondary };
  // 前日と比べて、1 日ごとに線を分ける。色だけに頼らず、下降は破線にする
  const segs = Array.from({ length: last }, (_, k) => {
    const i = k + 1;
    const dir = rateChange(FX_RATES, i)!.dir;
    return { i, dir, x1: x(i - 1), y1: y(FX_RATES[i - 1]!), x2: x(i), y2: y(FX_RATES[i]!) };
  });
  const ticks = [LO + 1, Math.round((LO + HI) / 2), HI - 1];

  return (
    <View
      accessible
      accessibilityLabel={`仮想の USD/JPY の日足。今日は ${FX_RATES[last]!.toFixed(2)} 円。${trendText(change)}上昇した日は青の実線、下降した日は赤の破線です。取引した日には、買いは上向き、売りは下向きの三角を付けています。`}
      style={{ width: '100%', maxWidth: 560, gap: 6 }}>
      <TrendBadge change={change} />
      <View style={{ width: '100%', aspectRatio: W / H }}>
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
        {segs.map((g) => (
          <Line
            key={g.i}
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
            stroke={color[g.dir]}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={g.dir === 'down' ? '5 3' : undefined}
          />
        ))}
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
      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        <ThemedText type="small" style={{ color: c.rateUp }}>
          ━ 上昇(青・実線)
        </ThemedText>
        <ThemedText type="small" style={{ color: c.rateDown }}>
          ╌ 下降(赤・破線)
        </ThemedText>
      </View>
    </View>
  );
}

const ARROW: Record<RateDirection, string> = { up: '▲', down: '▼', flat: '―' };
const WORD: Record<RateDirection, string> = { up: '上昇', down: '下降', flat: '変わらず' };

function trendText(ch: ReturnType<typeof rateChange>): string {
  if (!ch) return '前日がないため、前日比はありません。';
  return `前日比 ${WORD[ch.dir]} ${ch.diff >= 0 ? '+' : ''}${ch.diff.toFixed(2)} 円。`;
}

/** 今日の終値の前日比。色に加えて、矢印と言葉でも示す。 */
function TrendBadge({ change }: { change: ReturnType<typeof rateChange> }) {
  const c = useTheme();
  if (!change) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        前日比: 1 日目のため、まだありません
      </ThemedText>
    );
  }
  const col = change.dir === 'up' ? c.rateUp : change.dir === 'down' ? c.rateDown : c.textSecondary;
  const sign = change.diff > 0 ? '+' : change.diff < 0 ? '−' : '';
  return (
    <ThemedText type="smallBold" style={{ color: col }}>
      {ARROW[change.dir]} 前日比 {sign}
      {Math.abs(change.diff).toFixed(2)} 円({sign}
      {Math.abs(change.pct).toFixed(2)}%)・{WORD[change.dir]}
    </ThemedText>
  );
}
