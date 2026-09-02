import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getNextReviewDate,
  getReviewIntervalDays,
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

  it("defines the review interval sequence", () => {
    expect(REVIEW_INTERVALS_DAYS).toEqual([1, 3, 7, 14, 30]);
  });

  it("maps the reviewed-day count to its interval", () => {
    expect(getReviewIntervalDays(0)).toBe(1);
    expect(getReviewIntervalDays(1)).toBe(3);
    expect(getReviewIntervalDays(2)).toBe(7);
    expect(getReviewIntervalDays(3)).toBe(14);
    expect(getReviewIntervalDays(4)).toBe(30);
  });

  // 회차 상한이 없으므로 시퀀스를 넘어서도 다음 일정이 항상 존재해야 한다.
  it("repeats the last interval beyond the sequence", () => {
    expect(getReviewIntervalDays(5)).toBe(30);
    expect(getReviewIntervalDays(99)).toBe(30);
  });

  it("clamps a negative count to the first interval", () => {
    expect(getReviewIntervalDays(-1)).toBe(1);
  });

  it("returns the next review date for the reviewed-day count", () => {
    expect(getNextReviewDate(0).toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(getNextReviewDate(1).toISOString()).toBe("2026-01-04T00:00:00.000Z");
    expect(getNextReviewDate(2).toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(getNextReviewDate(3).toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(getNextReviewDate(4).toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(getNextReviewDate(10).toISOString()).toBe(
      "2026-01-31T00:00:00.000Z",
    );
  });
});
