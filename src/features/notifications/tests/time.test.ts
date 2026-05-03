import { describe, expect, it } from "vitest";

import {
  clampTimePart,
  getNumericInput,
  getTimeParts,
  padTimePart,
  toInputTime,
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
