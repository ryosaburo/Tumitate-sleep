import { describe, expect, it } from "vitest";
import { FX_RATES } from "./fx";
import { rateChange } from "./rateTrend";

describe("rateChange", () => {
  it("上昇・下降・変わらないを判定し、前日比を丸める", () => {
    expect(rateChange([150, 150.42], 1)).toEqual({ dir: "up", diff: 0.42, pct: 0.28 });
    expect(rateChange([150.42, 149.85], 1)).toEqual({ dir: "down", diff: -0.57, pct: -0.38 });
    expect(rateChange([150, 150], 1)).toEqual({ dir: "flat", diff: 0, pct: 0 });
  });
  it("1 日目と範囲外は null", () => {
    expect(rateChange(FX_RATES, 0)).toBeNull();
    expect(rateChange(FX_RATES, 99)).toBeNull();
  });
  it("仮想レートの 2 日目は上昇(+0.42)", () => {
    expect(rateChange(FX_RATES, 1)?.dir).toBe("up");
  });
});
