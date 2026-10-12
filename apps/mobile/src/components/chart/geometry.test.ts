import { describe, expect, it } from "vitest";
import { bandPath, dayFromX, L, man, PW, xo, ya, Y2, H2 } from "./geometry";

describe("geometry", () => {
  it("dayFromX は xo の逆変換になる", () => {
    for (const d of [1, 7, 15, 30]) expect(dayFromX(xo(d), 30)).toBe(d);
  });
  it("はみ出した位置は、1日目〜経過日の範囲に収める", () => {
    expect(dayFromX(0, 30)).toBe(1);
    expect(dayFromX(L + PW + 50, 12)).toBe(12);
    expect(dayFromX(100, 0)).toBe(1);
  });
  it("ya は 0 で下端、上限で上端", () => {
    expect(ya(0, 100)).toBe(Y2 + H2);
    expect(ya(100, 100)).toBe(Y2);
  });
  it("bandPath は点がなければ空", () => {
    expect(bandPath([], () => 0, () => 0, 100)).toBe("");
    expect(bandPath([1, 2], (v) => v, () => 0, 100).endsWith("Z")).toBe(true);
  });
  it("man は万円表記", () => {
    expect([man(0), man(25000), man(500)]).toEqual(["0", "2.5万", "500"]);
  });
});
