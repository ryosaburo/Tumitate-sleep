import { describe, expect, it } from "vitest";
import { validateSleepEdit } from "./sleepEdit";

const today = "2026-10-12";
const ok = { date: "2026-10-12", bed: "23:30", wake: "06:30" };

describe("validateSleepEdit", () => {
  it("正しい入力は 20:00 起点の分にする", () => {
    expect(validateSleepEdit(ok, today)).toEqual({ ok: true, date: "2026-10-12", bed: 210, wake: 630 });
  });
  it("H:MM(1桁の時)も受け付ける", () => {
    expect(validateSleepEdit({ ...ok, bed: "1:00", wake: "8:00" }, today)).toMatchObject({ ok: true, bed: 300, wake: 720 });
  });
  it("起床が就寝以前ならエラー", () => {
    expect(validateSleepEdit({ ...ok, bed: "06:30", wake: "06:30" }, today).ok).toBe(false);
    expect(validateSleepEdit({ ...ok, bed: "03:00", wake: "02:00" }, today).ok).toBe(false);
  });
  it("16時間ちょうどは OK、16時間1分はエラー", () => {
    expect(validateSleepEdit({ ...ok, bed: "20:00", wake: "12:00" }, today).ok).toBe(true);
    expect(validateSleepEdit({ ...ok, bed: "19:59", wake: "12:00" }, today).ok).toBe(false);
  });
  it("未来の日付・形式の誤りはエラー", () => {
    expect(validateSleepEdit({ ...ok, date: "2026-10-13" }, today).ok).toBe(false);
    expect(validateSleepEdit({ ...ok, date: "2026-13-40" }, today).ok).toBe(false);
    expect(validateSleepEdit({ ...ok, bed: "25:00" }, today).ok).toBe(false);
    expect(validateSleepEdit({ ...ok, wake: "abc" }, today).ok).toBe(false);
  });
});
