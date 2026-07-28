import { describe, expect, it } from "vitest";

import { formatOperationalErrorDateTime } from "../utils/format-operational-error-date-time";

describe("formatOperationalErrorDateTime", () => {
  it("returns a formatted Korean date and time", () => {
    const result = formatOperationalErrorDateTime("2026-07-28T14:30:00+09:00");

    expect(result).toContain("2026");
    expect(result).toContain("7");
    expect(result).toContain("28");
  });

  it("returns a string", () => {
    expect(
      typeof formatOperationalErrorDateTime("2026-01-01T00:00:00+09:00"),
    ).toBe("string");
  });
});
