import { describe, expect, it } from "vitest";
import { normalizeStartDate, normalizeTime, toggleTask } from "./settingsEdit";

describe("toggleTask", () => {
  it("2個のときは外せない", () => {
    expect(toggleTask(["bed", "screen"], "bed").ok).toBe(false);
  });
  it("3個のときは足せない", () => {
    expect(toggleTask(["bed", "wake", "screen"], "caffeine").ok).toBe(false);
  });
  it("足すと並び順がそろう", () => {
    expect(toggleTask(["screen", "caffeine"], "bed")).toEqual({ ok: true, tasks: ["bed", "screen", "caffeine"] });
  });
  it("3個から1つ外せる", () => {
    expect(toggleTask(["bed", "screen", "caffeine"], "screen")).toEqual({ ok: true, tasks: ["bed", "caffeine"] });
  });
});

describe("normalizeTime", () => {
  it("1桁の時を2桁にする", () => expect(normalizeTime("6:30")).toBe("06:30"));
  it("範囲外・形式違いは null", () => {
    expect(normalizeTime("24:00")).toBeNull();
    expect(normalizeTime("12:60")).toBeNull();
    expect(normalizeTime("abc")).toBeNull();
  });
});

describe("normalizeStartDate", () => {
  it("空は null、正しい日付はそのまま", () => {
    expect(normalizeStartDate("")).toBeNull();
    expect(normalizeStartDate("2026-10-12")).toBe("2026-10-12");
  });
  it("存在しない日付・形式違いは undefined", () => {
    expect(normalizeStartDate("2026-02-30")).toBeUndefined();
    expect(normalizeStartDate("2026/10/12")).toBeUndefined();
  });
});
