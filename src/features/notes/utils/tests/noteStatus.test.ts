import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canStartReview,
  getReviewScheduleDisplay,
  getReviewStatus,
} from "../noteStatus";

function makeNote(overrides: {
  review_round?: number;
  next_review_at?: string | null;
  review_completed_at?: string | null;
}) {
  return {
    id: "test-id",
    title: "테스트",
    content: "내용",
    review_round: 0,
    next_review_at: null,
    review_completed_at: null,
    ...overrides,
  };
}

describe("getReviewStatus", () => {
  // 회차 상한이 사라져 횟수만으로는 완료가 되지 않는다. 완료는 사용자 표시뿐이다.
  it("복습을 여러 번 했어도 완료 표시가 없으면 completed가 아니다", () => {
    const note = makeNote({ review_round: 12, next_review_at: null });
    expect(getReviewStatus(note)).toBe("pending");
  });

  it("완료 표시가 있으면 completed", () => {
    const note = makeNote({
      review_round: 12,
      next_review_at: null,
      review_completed_at: "2026-05-01T00:00:00.000Z",
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

  it("사용자가 완료 표시하면 예정일이 지났어도 completed", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const note = makeNote({
      review_round: 1,
      next_review_at: past,
      review_completed_at: "2026-05-01T00:00:00.000Z",
    });
    expect(getReviewStatus(note)).toBe("completed");
  });
});

describe("canStartReview", () => {
  it("예정일이 지난 노트는 진입할 수 있다", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const note = makeNote({ review_round: 1, next_review_at: past });
    expect(canStartReview(note)).toBe(true);
  });

  // 목록과 상세가 어긋나던 지점이다. 예정일 전이라고 진입을 막지 않는다.
  it("예정일이 아직 오지 않은 노트도 진입할 수 있다", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    const note = makeNote({ review_round: 1, next_review_at: future });
    expect(canStartReview(note)).toBe(true);
  });

  it("다음 일정이 아직 준비되지 않은 노트는 진입할 수 없다", () => {
    const note = makeNote({ review_round: 0, next_review_at: null });
    expect(canStartReview(note)).toBe(false);
  });

  it("사용자가 완료 표시한 노트는 진입할 수 없다", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const note = makeNote({
      review_round: 1,
      next_review_at: past,
      review_completed_at: "2026-05-01T00:00:00.000Z",
    });
    expect(canStartReview(note)).toBe(false);
  });
});

describe("getReviewScheduleDisplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T14:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("completed → '완료'", () => {
    expect(getReviewScheduleDisplay("completed", null)).toMatchObject({
      label: "다음 복습일",
      primaryText: "완료",
      tone: "default",
    });
  });

  it("pending → '준비 중'", () => {
    expect(getReviewScheduleDisplay("pending", null).primaryText).toBe(
      "준비 중",
    );
  });

  it.each([
    ["available", "2026-05-01T13:00:00.000Z", "오늘"],
    ["scheduled", "2026-05-01T14:45:00.000Z", "오늘"],
    ["scheduled", "2026-05-01T15:00:00.000Z", "내일"],
    ["scheduled", "2026-05-02T15:00:00.000Z", "2일 후"],
    ["scheduled", "2026-05-07T15:00:00.000Z", "7일 후"],
  ] as const)("%s 일정 %s → '%s'", (status, date, expected) => {
    expect(getReviewScheduleDisplay(status, date).primaryText).toBe(expected);
  });

  it("지난 일정은 경과 일수를 반환한다", () => {
    expect(
      getReviewScheduleDisplay("available", "2026-04-28T15:00:00.000Z"),
    ).toEqual({
      label: "복습일",
      primaryText: "2일 지남",
      tone: "overdue",
    });
  });

  it("8일 이후 일정 → 짧은 날짜 문자열 반환", () => {
    expect(
      getReviewScheduleDisplay("scheduled", "2026-05-08T15:00:00.000Z")
        .primaryText,
    ).toBe("2026. 5. 9");
  });

  it("scheduled + next_review_at null → '-'", () => {
    expect(getReviewScheduleDisplay("scheduled", null).primaryText).toBe("-");
  });
});
