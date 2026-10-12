export type TaskKey = "bed" | "wake" | "screen" | "caffeine";
export type PresetKey = "safe" | "bal" | "grow";

/** 1 日分の記録。bed / wake は 20:00 起点の分。未記録は null。 */
export interface DayRecord {
  bed: number | null;
  wake: number | null;
  screen: boolean;
  caffeine: boolean;
}

/** 計算に必要な設定。目標時刻も 20:00 起点の分。 */
export interface Settings {
  targetBed: number;
  targetWake: number;
  /** 選んだ課題(2〜3 個)。 */
  tasks: TaskKey[];
  preset: PresetKey;
}

export interface DayStat {
  /** 達成した課題数 */
  n: number;
  /** 選んだ課題数 */
  k: number;
  /** 達成率(0〜1) */
  rate: number;
  /** クリア日(達成数 > 選んだ数 / 2) */
  clear: boolean;
  /** その日の積立額(円) */
  contrib: number;
}

export interface SimDay {
  /** その日の積立額 */
  c: number;
  /** 積立元本の累計 */
  principal: number;
  /** 運用後の評価額 */
  value: number;
  stat: DayStat;
  /** 損益(評価額 − 積立元本) */
  G: number;
  /** 複利の分 */
  comp: number;
  /** 運用益(元本分) */
  g1: number;
  /** 元本割れの額 */
  loss: number;
}

export interface RevealGroup {
  n: string;
  /** 積立した日の範囲(1 始まり、両端を含む) */
  a: number;
  b: number;
  cost: number;
  days: number;
  /** 増減率。積立がなければ null */
  ret: number | null;
}

export interface Reveal {
  /** 最大下落(負の値。−0.144 など) */
  maxDD: number;
  peakDay: number;
  troughDay: number;
  groups: RevealGroup[];
}

export interface WeekSummary {
  /** 0 始まり */
  index: number;
  /** 日の範囲(0 始まり、両端を含む) */
  from: number;
  to: number;
  clearDays: number;
  /** 週 5 日クリアで達成 */
  achieved: boolean;
  /** 就寝のズレの平均(分)。3 日未満の記録なら null */
  mad: number | null;
  /** 週末(to の日)の評価額 */
  endValue: number;
}
