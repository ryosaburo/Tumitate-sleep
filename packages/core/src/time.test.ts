import { describe, expect, it } from "vitest";
import { toAxisMinutes } from "./time";

describe("toAxisMinutes", () => {
  it("20:00 は 0 分", () => {
    expect(toAxisMinutes(20, 0)).toBe(0);
  });
  it("23:30 は 210 分", () => {
    expect(toAxisMinutes(23, 30)).toBe(210);
  });
  it("0:00 は 240 分(日付をまたぐ)", () => {
    expect(toAxisMinutes(0, 0)).toBe(240);
  });
  it("7:00 は 660 分", () => {
    expect(toAxisMinutes(7, 0)).toBe(660);
  });
});
