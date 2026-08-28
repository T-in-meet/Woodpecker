import { describe, expect, it } from "vitest";

import {
  addDaysToDateKey,
  clampTimePart,
  fromDateKey,
  getKstDateKey,
  getKstTimeValue,
  getNumericInput,
  getTimeParts,
  isWithinScheduleRange,
  padTimePart,
  toInputTime,
  toScheduledAt,
  toTimeValue,
} from "../lib/time";

describe("notification time helpers", () => {
  it.each([
    ["00:00", { hour: "12", minute: "00", period: "am" }],
    ["08:15", { hour: "08", minute: "15", period: "am" }],
    ["12:00", { hour: "12", minute: "00", period: "pm" }],
    ["21:30", { hour: "09", minute: "30", period: "pm" }],
  ])("converts 24-hour time %s to visible 12-hour parts", (time, expected) => {
    expect(getTimeParts(time)).toEqual(expected);
  });

  it.each([
    ["am", "12", "00", "00:00"],
    ["am", "12", "30", "00:30"],
    ["pm", "12", "00", "12:00"],
    ["pm", "12", "30", "12:30"],
    ["am", "09", "05", "09:05"],
    ["pm", "09", "05", "21:05"],
  ] as const)(
    "converts %s %s:%s to a 24-hour value",
    (period, hour, minute, expected) => {
      expect(toTimeValue(period, hour, minute)).toBe(expected);
    },
  );

  it("keeps an empty draft empty", () => {
    expect(getTimeParts("")).toEqual({ hour: "", minute: "", period: "am" });
    expect(toTimeValue("am", "", "")).toBe("");
  });

  it.each([
    ["am", "0", "00"],
    ["am", "13", "00"],
    ["am", "12", "60"],
  ] as const)("rejects invalid time value %s %s:%s", (period, hour, minute) => {
    expect(toTimeValue(period, hour, minute)).toBeNull();
  });

  it("normalizes raw input helpers", () => {
    expect(toInputTime("21:30:00")).toBe("21:30");
    expect(toInputTime(null)).toBe("");
    expect(padTimePart(7)).toBe("07");
    expect(getNumericInput("a1b23")).toBe("12");
    expect(clampTimePart("0", 1, 12)).toBe("01");
    expect(clampTimePart("99", 0, 59)).toBe("59");
  });
});

describe("notification schedule date helpers", () => {
  it("reads the KST calendar day of an instant", () => {
    // UTC 2026-05-01 15:30 → KST 2026-05-02 00:30
    expect(getKstDateKey(new Date("2026-05-01T15:30:00.000Z"))).toBe(
      "2026-05-02",
    );
    expect(getKstDateKey(new Date("2026-05-01T14:00:00.000Z"))).toBe(
      "2026-05-01",
    );
  });

  it("reads the KST wall-clock time of an instant", () => {
    expect(getKstTimeValue("2026-05-01T12:30:00.000Z")).toBe("21:30");
    expect(getKstTimeValue("2026-05-01T15:00:00.000Z")).toBe("00:00");
    expect(getKstTimeValue("not-a-date")).toBe("");
  });

  it("turns a date key into a local Date for display", () => {
    expect(fromDateKey("2026-05-05")?.getDate()).toBe(5);
    expect(fromDateKey("nope")).toBeNull();
  });

  it("adds days across month boundaries", () => {
    expect(addDaysToDateKey("2026-05-01", 30)).toBe("2026-05-31");
    expect(addDaysToDateKey("2026-05-31", 1)).toBe("2026-06-01");
  });

  it("combines a date key and a time into a KST instant", () => {
    expect(toScheduledAt("2026-05-01", "21:30")).toBe(
      "2026-05-01T12:30:00.000Z",
    );
    expect(toScheduledAt("2026-05-01", "24:99")).toBeNull();
  });

  it("allows only today through the 30th day ahead", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");

    expect(isWithinScheduleRange("2026-05-01", now)).toBe(true);
    expect(isWithinScheduleRange("2026-05-31", now)).toBe(true);
    expect(isWithinScheduleRange("2026-04-30", now)).toBe(false);
    expect(isWithinScheduleRange("2026-06-01", now)).toBe(false);
  });
});
