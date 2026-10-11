import { dayStat } from "./achievement";
import { DAYS, PRESETS, PX } from "./constants";
import type { DayRecord, Settings, SimDay } from "./types";

/**
 * 30 日分の積立と評価額を計算する。records は 0 日目から。足りない日は未記録として扱う。
 * 毎日の損益を、積立元本にかかった分(A)と、それまでの損益にかかった分(B)に分ける。
 * B が複利の分(計画書 §5.5)。
 */
export function simulate(records: readonly (DayRecord | null)[], s: Settings): SimDay[] {
  const w = PRESETS[s.preset];
  const units = { eq: 0, bd: 0, cash: 0 };
  let principal = 0;
  let B = 0;
  let prevG = 0;
  const out: SimDay[] = [];
  for (let i = 0; i < DAYS; i++) {
    const stat = dayStat(records[i] ?? null, s);
    const c = stat.contrib;
    principal += c;
    units.eq += (c * w.eq) / PX.eq[i]!;
    units.bd += (c * w.bd) / PX.bd[i]!;
    units.cash += c * w.cash;
    const before = units.eq * PX.eq[i]! + units.bd * PX.bd[i]! + units.cash;
    const after = units.eq * PX.eq[i + 1]! + units.bd * PX.bd[i + 1]! + units.cash;
    if (before > 0) {
      B += ((after - before) * prevG) / before;
    }
    const G = after - principal;
    prevG = G;
    const comp = G > 0 ? Math.max(0, Math.min(B, G)) : 0;
    out.push({
      c,
      principal,
      value: after,
      stat,
      G,
      comp,
      g1: G > 0 ? G - comp : 0,
      loss: G < 0 ? -G : 0,
    });
  }
  return out;
}
