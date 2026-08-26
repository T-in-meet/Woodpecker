import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getNextReviewText, getReviewStatus } from "../noteStatus";

const MAX_REVIEW_ROUND = 3;

function makeNote(overrides: {
  review_round?: number;
  next_review_at?: string | null;
}) {
  return {
    id: "test-id",
    title: "테스트",
    content: "내용",
    review_round: 0,
    next_review_at: null,
    ...overrides,
  };
}

describe("getReviewStatus", () => {
  it("최대 라운드 완료 + next_review_at null → completed", () => {
    const note = makeNote({
      review_round: MAX_REVIEW_ROUND,
      next_review_at: null,
    });
    expect(getReviewStatus(note)).toBe("completed");
  });

  it("next_review_at null이고 라운드 미완료 → pending", () => {
    const note = makeNote({ review_round: 0, next_review_at: null });
    expect(getReviewStatus(note)).toBe("pending");
  });

  it("next_review_at이 과거 → available", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const note = makeNote({ review_round: 1, next_review_at: past });
    expect(getReviewStatus(note)).toBe("available");
  });

  it("next_review_at이 미래 → scheduled", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    const note = makeNote({ review_round: 1, next_review_at: future });
    expect(getReviewStatus(note)).toBe("scheduled");
  });

  it("next_review_at이 현재 시각과 동일(경계) → available", () => {
    const now = new Date(Date.now() - 1).toISOString();
    const note = makeNote({ review_round: 1, next_review_at: now });
    expect(getReviewStatus(note)).toBe("available");
  });
});

describe("getNextReviewText", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T14:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("completed → '완료'", () => {
    expect(getNextReviewText("completed", null)).toBe("완료");
  });

  it("pending → '준비 중'", () => {
    expect(getNextReviewText("pending", null)).toBe("준비 중");
  });

  it.each([
    ["available", "2026-05-01T13:00:00.000Z", "오늘"],
    ["scheduled", "2026-05-01T14:45:00.000Z", "오늘"],
    ["scheduled", "2026-05-01T15:00:00.000Z", "내일"],
    ["scheduled", "2026-05-02T15:00:00.000Z", "2일 후"],
    ["scheduled", "2026-05-07T15:00:00.000Z", "7일 후"],
  ] as const)("%s 일정 %s → '%s'", (status, date, expected) => {
    expect(getNextReviewText(status, date)).toBe(expected);
  });

  it("8일 이후 일정 → 짧은 날짜 문자열 반환", () => {
    expect(getNextReviewText("scheduled", "2026-05-08T15:00:00.000Z")).toBe(
      "2026. 5. 9",
    );
  });

  it("scheduled + next_review_at null → '-'", () => {
    expect(getNextReviewText("scheduled", null)).toBe("-");
  });
});
