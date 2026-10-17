import { AI_DAILY_LIMIT, AI_GLOBAL_DAILY_LIMIT, AI_MAX_RATES, AI_TIMEOUT_MS, FX_MAX_FUND, FX_ORDER_RATIO, FX_ORDER_STEP, buildAiPrompt, normalizeAiDecision } from "@nekase/core";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";

export const fx = new Hono<AppEnv>();
fx.use(requireAuth);

/** 既定のモデル(JSON モードに対応)。環境変数 AI_MODEL で入れ替えられる。 */
export const DEFAULT_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** 受け取るのは、仮想レート・ゲージの数値・注文額の上限だけ(計画書 §6.6、D17)。それ以外の項目は捨てる。 */
const AiOrderRequest = z.object({
  rates: z.array(z.number().min(50).max(300)).min(1).max(AI_MAX_RATES),
  gauge: z.number().int().min(0).max(100),
  limit: z.number().int().min(0).max(FX_MAX_FUND * FX_ORDER_RATIO).multipleOf(FX_ORDER_STEP),
});

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    side: { type: "string", enum: ["buy", "sell", "skip"] },
    amount: { type: "number" },
    stopPct: { type: "number", enum: [0.5, 1, 2] },
    comment: { type: "string" },
  },
  required: ["side", "amount", "stopPct", "comment"],
};

/** 全体の回数を数える行のキー(アカウント ID は UUID なので、重ならない) */
const GLOBAL_KEY = "*";

/** 日本時間の日付 'YYYY-MM-DD'。1 日の回数の数え方に使う。 */
const jstDay = (ms: number): string => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);

/** Workers AI の返り値({ response: 文字列 または オブジェクト })から、JSON を取り出す。 */
function extractJson(result: unknown): unknown {
  const r = typeof result === "object" && result !== null ? (result as { response?: unknown }).response : undefined;
  if (typeof r === "string") {
    try {
      return JSON.parse(r);
    } catch {
      return null;
    }
  }
  return r ?? null;
}

fx.post("/ai-order", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new ApiError(400, "invalid_request", "入力が正しくありません: (本文) JSON ではありません");
  });
  const req = AiOrderRequest.parse(body);

  // 緊急停止(費用)。止めている間は、回数も数えない。
  if (c.env.AI_DISABLED === "1") throw new ApiError(503, "ai_disabled", "AI は、いまお休み中です。自分で注文できます。");

  // 全体の 1 日の上限(無料枠を使い切らないための安全装置)。上限に達していたら、AI は呼ばない。
  const day = jstDay(Date.now());
  const all = await c.env.DB.prepare("SELECT n FROM ai_usage WHERE account_id = ? AND day = ?").bind(GLOBAL_KEY, day).first<{ n: number }>();
  if ((all?.n ?? 0) >= AI_GLOBAL_DAILY_LIMIT) {
    throw new ApiError(429, "ai_busy", "今日は、AI が混み合っています。自分で注文できます。");
  }

  // アカウントごとの 1 日の回数の制限(失敗した呼び出しも数える)。上限に達していたら、AI は呼ばない。
  const taken = await c.env.DB.prepare(
    "INSERT INTO ai_usage (account_id, day, n) VALUES (?, ?, 1) ON CONFLICT (account_id, day) DO UPDATE SET n = n + 1 WHERE n < ?",
  )
    .bind(c.get("accountId"), day, AI_DAILY_LIMIT)
    .run();
  if (taken.meta.changes !== 1) {
    throw new ApiError(429, "ai_limit", `AI を呼べるのは、1 日 ${AI_DAILY_LIMIT} 回までです。自分で注文できます。`);
  }
  await c.env.DB.prepare("INSERT INTO ai_usage (account_id, day, n) VALUES (?, ?, 1) ON CONFLICT (account_id, day) DO UPDATE SET n = n + 1").bind(GLOBAL_KEY, day).run();

  const { system, user } = buildAiPrompt(req);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let result: unknown;
  try {
    result = await Promise.race([
      c.env.AI.run((c.env.AI_MODEL ?? DEFAULT_AI_MODEL) as keyof AiModels, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_schema", json_schema: ANSWER_SCHEMA },
        max_tokens: 200,
      } as never),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ApiError(504, "ai_timeout", "AI の応答が遅れています。自分で注文できます。")), AI_TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.error("[nekase/api] Workers AI の呼び出しに失敗", e);
    throw new ApiError(502, "ai_unavailable", "AI が使えませんでした。自分で注文できます。");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  const decision = normalizeAiDecision(extractJson(result), req.limit);
  if (!decision) throw new ApiError(502, "ai_bad_response", "AI の返答を読み取れませんでした。自分で注文できます。");
  return c.json({ decision });
});
