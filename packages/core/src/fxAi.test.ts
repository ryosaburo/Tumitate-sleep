import { describe, expect, it } from "vitest";
import { AI_COMMENT_MAX, AI_PERSONA, buildAiPrompt, normalizeAiDecision } from "./fxAi";

const req = (gauge: number) => ({ rates: [150, 150.4, 149.9], gauge, limit: 4000 });

describe("AI の指示", () => {
  it("ゲージの高・中・低で、設定が変わる", () => {
    const [h, m, l] = [90, 50, 10].map((g) => buildAiPrompt(req(g)).system);
    expect(h).toContain(AI_PERSONA.high.instruction);
    expect(m).toContain(AI_PERSONA.mid.instruction);
    expect(l).toContain(AI_PERSONA.low.instruction);
    expect(new Set([h, m, l]).size).toBe(3);
  });
  it("ゲージの境界(70 は高、40 は中、39 は低)", () => {
    expect(buildAiPrompt(req(70)).system).toContain(AI_PERSONA.high.instruction);
    expect(buildAiPrompt(req(69)).system).toContain(AI_PERSONA.mid.instruction);
    expect(buildAiPrompt(req(40)).system).toContain(AI_PERSONA.mid.instruction);
    expect(buildAiPrompt(req(39)).system).toContain(AI_PERSONA.low.instruction);
  });
  it("渡すのはレートと上限だけ。睡眠の時刻や ID は含めない", () => {
    const p = buildAiPrompt(req(50));
    expect(p.user).toContain("150.00, 150.40, 149.90");
    expect(p.user).toContain("4,000");
    expect(p.system + p.user).not.toMatch(/就寝|起床|\d{2}:\d{2}|accountId/);
  });
  it("学習用であることを伝える", () => {
    expect(buildAiPrompt(req(50)).system).toContain("学習用");
  });
});

describe("AI の返答を収める", () => {
  it("正しい返答はそのまま", () => {
    expect(normalizeAiDecision({ side: "buy", amount: 2000, stopPct: 1, comment: "上昇が続いたため" }, 4000)).toEqual({
      side: "buy",
      amount: 2000,
      stopPct: 1,
      comment: "上昇が続いたため",
    });
  });
  it("金額は上限と刻みに収める", () => {
    expect(normalizeAiDecision({ side: "sell", amount: 99999, stopPct: 1 }, 4000)).toMatchObject({ amount: 4000 });
    expect(normalizeAiDecision({ side: "sell", amount: 1500, stopPct: 1 }, 4000)).toMatchObject({ amount: 1000 });
    expect(normalizeAiDecision({ side: "sell", amount: 10, stopPct: 1 }, 4000)).toMatchObject({ amount: 1000 });
    expect(normalizeAiDecision({ side: "buy", amount: -5, stopPct: 1 }, 4000)).toMatchObject({ amount: 1000 });
  });
  it("損切りは 3 択の近い値に収める", () => {
    expect(normalizeAiDecision({ side: "buy", amount: 1000, stopPct: 5 }, 4000)).toMatchObject({ stopPct: 2 });
    expect(normalizeAiDecision({ side: "buy", amount: 1000, stopPct: 0 }, 4000)).toMatchObject({ stopPct: 0.5 });
    expect(normalizeAiDecision({ side: "buy", amount: 1000, stopPct: 0.9 }, 4000)).toMatchObject({ stopPct: 1 });
  });
  it("見送りは、金額や損切りがなくてもよい", () => {
    expect(normalizeAiDecision({ side: "skip", comment: "様子を見ます" }, 4000)).toEqual({ side: "skip", comment: "様子を見ます" });
  });
  it("形が違えば null(注文しない)", () => {
    for (const bad of [null, "buy", 3, {}, { side: "hold" }, { side: "buy" }, { side: "buy", amount: "2000", stopPct: 1 }, { side: "buy", amount: NaN, stopPct: 1 }]) {
      expect(normalizeAiDecision(bad, 4000)).toBeNull();
    }
  });
  it("上限が 1 刻み未満なら、買い・売りは注文しない(見送りは通す)", () => {
    expect(normalizeAiDecision({ side: "buy", amount: 1000, stopPct: 1 }, 800)).toBeNull();
    expect(normalizeAiDecision({ side: "skip" }, 0)).toEqual({ side: "skip", comment: "" });
  });
  it("理由は 80 字までに切り、改行を詰める", () => {
    const d = normalizeAiDecision({ side: "skip", comment: "あ".repeat(200) }, 4000)!;
    expect([...d.comment]).toHaveLength(AI_COMMENT_MAX);
    expect(normalizeAiDecision({ side: "skip", comment: "a\n\n b" }, 4000)!.comment).toBe("a b");
    expect(normalizeAiDecision({ side: "skip", comment: 5 }, 4000)!.comment).toBe("");
  });
});
