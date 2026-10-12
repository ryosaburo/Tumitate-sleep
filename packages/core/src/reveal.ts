import { DAYS, PRESETS, PX } from "./constants";
import type { PresetKey, Reveal, SimDay } from "./types";

/** 30 日目の答え合わせ。世界株式の最大下落と、積立した時期ごとの増減を出す。 */
export function reveal(sim: readonly SimDay[], preset: PresetKey): Reveal {
  const w = PRESETS[preset];
  let runPeak = 1;
  let runDay = 0;
  let maxDD = 0;
  let peakDay = 0;
  let troughDay = 0;
  for (let k = 1; k <= DAYS; k++) {
    const p = PX.eq[k]!;
    if (p > runPeak) {
      runPeak = p;
      runDay = k;
    }
    const dd = p / runPeak - 1;
    if (dd < maxDD) {
      maxDD = dd;
      troughDay = k;
      peakDay = runDay;
    }
  }
  const ranges = [
    { n: "下落の前", a: 1, b: peakDay },
    { n: "下落の最中", a: peakDay + 1, b: troughDay },
    { n: "回復のあと", a: troughDay + 1, b: DAYS },
  ];
  const groups = ranges.map((g) => {
    let cost = 0;
    let val = 0;
    let days = 0;
    for (let k = g.a; k <= g.b; k++) {
      const c = sim[k - 1]?.c ?? 0;
      if (!c) continue;
      cost += c;
      days++;
      val +=
        c *
        ((w.eq * PX.eq[DAYS]!) / PX.eq[k - 1]! +
          (w.bd * PX.bd[DAYS]!) / PX.bd[k - 1]! +
          w.cash);
    }
    return { ...g, cost, days, ret: cost ? val / cost - 1 : null };
  });
  return { maxDD, peakDay, troughDay, groups };
}
