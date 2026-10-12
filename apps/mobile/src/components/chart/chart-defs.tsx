import { Defs, Line, Pattern } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/** 色以外の手がかり(模様)の定義。運用益=斜線、複利の分=格子、元本割れ=縦線、睡眠の外れ=斜線。 */
export function ChartDefs() {
  const c = useTheme();
  return (
    <Defs>
      <Pattern id="hatch-gain" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <Line x1={0} y1={0} x2={0} y2={5} stroke={c.assetL3} strokeWidth={1.3} />
      </Pattern>
      <Pattern id="hatch-comp" width={4} height={4} patternUnits="userSpaceOnUse">
        <Line x1={0} y1={0} x2={0} y2={4} stroke={c.background} strokeWidth={1.2} />
        <Line x1={0} y1={0} x2={4} y2={0} stroke={c.background} strokeWidth={1.2} />
      </Pattern>
      <Pattern id="hatch-loss" width={4} height={4} patternUnits="userSpaceOnUse">
        <Line x1={0} y1={0} x2={0} y2={4} stroke={c.textSecondary} strokeWidth={1.4} />
      </Pattern>
    </Defs>
  );
}
