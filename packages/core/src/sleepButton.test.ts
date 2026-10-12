import { describe, expect, it } from "vitest";
import { pendingState, wakeRecord } from "./sleepButton";

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();

describe("pendingState", () => {
  it("押していなければ none", () => {
    expect(pendingState(null, at(12, 8)).kind).toBe("none");
  });
  it("17時間59分は sleeping、18時間ちょうどは stale", () => {
    const bed = at(11, 23, 30);
    expect(pendingState(bed, bed + 18 * 3600000 - 60000).kind).toBe("sleeping");
    expect(pendingState(bed, bed + 18 * 3600000).kind).toBe("stale");
  });
  it("未来の時刻は none", () => {
    expect(pendingState(at(12, 9), at(12, 8)).kind).toBe("none");
  });
});

describe("wakeRecord", () => {
  it("日またぎ: 23:30 → 06:30 は、起床日の記録", () => {
    expect(wakeRecord(at(11, 23, 30), at(12, 6, 30))).toEqual({ date: "2026-10-12", bed: 210, wake: 630 });
  });
  it("日をまたがない: 01:00 → 08:00", () => {
    expect(wakeRecord(at(12, 1), at(12, 8))).toEqual({ date: "2026-10-12", bed: 300, wake: 720 });
  });
});
