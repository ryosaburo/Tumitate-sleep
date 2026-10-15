import { FX_ORDER_STEP, FX_STOP_PCTS, gaugeLevel, type GaugeLevel, type Side, type StopPct } from "./fx";

/** AI の返答の理由の最大文字数。 */
export const AI_COMMENT_MAX = 80;
/** 1 アカウントが 1 日に AI を呼べる回数(失敗の再試行を含む)。 */
export const AI_DAILY_LIMIT = 3;
/** AI の応答を待つ時間(ミリ秒)。超えたら注文せず、手動の注文へ案内する。 */
export const AI_TIMEOUT_MS = 10_000;
/** AI に渡すレートの最大本数(今日を含む直近)。 */
export const AI_MAX_RATES = 7;

/**
 * ゲージ別の AI の設定(計画書 §6.6)。「学習用の演出」で、睡眠不足が実際に判断を悪くすると示すものではない。
 * 画面にも同じ説明を出す。
 */
export const AI_PERSONA: Record<GaugeLevel, { label: string; instruction: string }> = {
  high: {
    label: "規則に沿う",
    instruction:
      "あなたは落ち着いた練習用トレーダーです。直近の値動きと損切り幅を比べて、規則に沿って判断します。根拠が弱いときは見送ります。",
  },
  mid: {
    label: "やや引っ張られる",
    instruction:
      "あなたは練習用トレーダーです。基本は規則に沿いますが、直近の値動きに少し引っ張られます。見送りは、迷ったときだけ選びます。",
  },
  low: {
    label: "値動きに飛びつく",
    instruction:
      "あなたは疲れていて集中できない練習用トレーダーです。直近の値動きに飛びつきます(上がったあとに買い、下がったあとに売る)。損切りは深く考えず、0.5% か 2% を気分で選びます。見送りはほとんど選びません。",
  },
};

export interface AiOrderRequest {
  /** 直近の終値(古い順、最後が今日)。1〜AI_MAX_RATES 本 */
  rates: number[];
  /** 判断力ゲージ(0〜100) */
  gauge: number;
  /** 今日の注文額の上限(円) */
  limit: number;
}

export type AiDecision =
  | { side: Side; amount: number; stopPct: StopPct; comment: string }
  | { side: "skip"; comment: string };

/** Workers AI に渡す指示。睡眠の時刻や記録は含めない(渡すのは、レート・ゲージ・上限だけ)。 */
export function buildAiPrompt(req: AiOrderRequest): { system: string; user: string } {
  const persona = AI_PERSONA[gaugeLevel(req.gauge)];
  const system = [
    persona.instruction,
    "これは学習用の仮想取引(USD/JPY)です。実際の売買ではなく、投資助言でもありません。",
    "次の JSON だけを返してください。",
    '{"side":"buy"|"sell"|"skip","amount":数値(円),"stopPct":0.5|1|2,"comment":"理由(日本語、80字以内)"}',
    "buy は円安になる、sell は円高になる、と考える注文です。skip のときは amount と stopPct は 0 にしてください。",
  ].join("\n");
  const rates = req.rates.map((r) => r.toFixed(2)).join(", ");
  const user = [
    `直近の終値(古い順、最後が今日): ${rates}`,
    `注文額は ${FX_ORDER_STEP.toLocaleString("en-US")} 円刻みで、上限は ${req.limit.toLocaleString("en-US")} 円です。`,
    `損切り(必須)は ${FX_STOP_PCTS.join(" / ")}% から選びます。`,
  ].join("\n");
  return { system, user };
}

const nearestStop = (v: number): StopPct =>
  FX_STOP_PCTS.reduce((best, p) => (Math.abs(p - v) < Math.abs(best - v) ? p : best), FX_STOP_PCTS[1]);

const cleanComment = (v: unknown): string =>
  typeof v === "string" ? [...v.replace(/\s+/g, " ").trim()].slice(0, AI_COMMENT_MAX).join("") : "";

/**
 * AI の返答を、安全な範囲に収める。形が違えば null(注文しない)。
 * 金額は上限と刻みに、損切りは 3 択のいちばん近い値に収める。上限が 1 刻み未満なら注文できない。
 * 最終的な検証は、端末側で core の validateOrder がもう一度行う。
 */
export function normalizeAiDecision(raw: unknown, limit: number): AiDecision | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const comment = cleanComment(r.comment);
  if (r.side === "skip") return { side: "skip", comment };
  if (r.side !== "buy" && r.side !== "sell") return null;
  if (typeof r.amount !== "number" || !Number.isFinite(r.amount) || typeof r.stopPct !== "number" || !Number.isFinite(r.stopPct)) {
    return null;
  }
  const cap = Math.floor(limit / FX_ORDER_STEP) * FX_ORDER_STEP;
  if (cap < FX_ORDER_STEP) return null;
  const amount = Math.min(Math.max(Math.floor(r.amount / FX_ORDER_STEP) * FX_ORDER_STEP, FX_ORDER_STEP), cap);
  return { side: r.side, amount, stopPct: nearestStop(r.stopPct), comment };
}
