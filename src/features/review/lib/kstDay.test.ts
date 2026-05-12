import { describe, expect, it } from "vitest";

import { getKstDayBoundsUtc } from "./kstDay";

describe("getKstDayBoundsUtc", () => {
  it("returns UTC bounds for the KST day containing the current time", () => {
    expect(getKstDayBoundsUtc(new Date("2026-04-23T14:30:00.000Z"))).toEqual({
      startUtcIso: "2026-04-22T15:00:00.000Z",
      endUtcIso: "2026-04-23T15:00:00.000Z",
    });
  });

  it("starts a new KST day exactly at KST midnight", () => {
    expect(getKstDayBoundsUtc(new Date("2026-04-23T15:00:00.000Z"))).toEqual({
      startUtcIso: "2026-04-23T15:00:00.000Z",
      endUtcIso: "2026-04-24T15:00:00.000Z",
    });
  });

  it("keeps the current KST day until the moment before the next midnight", () => {
    expect(getKstDayBoundsUtc(new Date("2026-04-24T14:59:59.999Z"))).toEqual({
      startUtcIso: "2026-04-23T15:00:00.000Z",
      endUtcIso: "2026-04-24T15:00:00.000Z",
    });
  });
});
