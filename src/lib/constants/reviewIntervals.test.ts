import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getNextReviewDate,
  MAX_REVIEW_ROUND,
  REVIEW_INTERVALS_DAYS,
} from "./reviewIntervals";

describe("reviewIntervals", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defines three review rounds", () => {
    expect(REVIEW_INTERVALS_DAYS).toEqual([1, 3, 7]);
    expect(MAX_REVIEW_ROUND).toBe(3);
  });

  it("returns the next review date for the next pending round", () => {
    expect(getNextReviewDate(0)?.toISOString()).toBe(
      "2026-01-02T00:00:00.000Z",
    );
    expect(getNextReviewDate(1)?.toISOString()).toBe(
      "2026-01-04T00:00:00.000Z",
    );
    expect(getNextReviewDate(2)?.toISOString()).toBe(
      "2026-01-08T00:00:00.000Z",
    );
  });

  it("returns null when there is no next review round", () => {
    expect(getNextReviewDate(-1)).toBeNull();
    expect(getNextReviewDate(MAX_REVIEW_ROUND)).toBeNull();
  });
});
