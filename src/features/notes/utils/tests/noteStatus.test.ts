import { describe, expect, it } from "vitest";

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
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
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
  it("completed → '완료'", () => {
    expect(getNextReviewText("completed", null)).toBe("완료");
  });

  it("pending → '준비 중'", () => {
    expect(getNextReviewText("pending", null)).toBe("준비 중");
  });

  it("scheduled + next_review_at → 날짜 문자열 반환", () => {
    const date = "2026-05-10T12:00:00Z";
    const result = getNextReviewText("scheduled", date);
    expect(result).toContain("2026");
  });

  it("available + next_review_at → 날짜 문자열 반환", () => {
    const date = "2026-05-01T00:00:00Z";
    const result = getNextReviewText("available", date);
    expect(result).toContain("2026");
  });

  it("scheduled + next_review_at null → '-'", () => {
    expect(getNextReviewText("scheduled", null)).toBe("-");
  });
});
