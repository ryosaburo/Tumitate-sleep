import { describe, expect, it } from "vitest";
import { defaultSettings } from "../storage/common";
import { toDayRecord, toSettings } from "./convert";

describe("convert", () => {
  it("記録の行を DayRecord にする", () => {
    expect(toDayRecord({ date: "2026-10-12", bed_min: 210, wake_min: null, screen: 1, caffeine: 0, updated_at: 1 })).toEqual({
      bed: 210,
      wake: null,
      screen: true,
      caffeine: false,
    });
    expect(toDayRecord(null)).toBeNull();
  });
  it("既定の設定を Settings にする(23:30 → 210、06:30 → 630)", () => {
    expect(toSettings(defaultSettings(0))).toEqual({
      targetBed: 210,
      targetWake: 630,
      tasks: ["bed", "screen", "caffeine"],
      preset: "bal",
    });
  });
});
