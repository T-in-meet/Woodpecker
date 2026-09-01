import { DAY_IN_MS, KST_OFFSET_MS } from "@/lib/constants/time";
import { formatShortDateKST } from "@/lib/utils/formatDate";

import type { NoteSummary } from "../queries";

export type ReviewStatus = "available" | "completed" | "scheduled" | "pending";
export type ReviewScheduleTone = "default" | "overdue" | "today" | "upcoming";

export type ReviewScheduleDisplay = {
  label: "다음 복습일" | "복습일";
  primaryText: string;
  tone: ReviewScheduleTone;
};

/**
 * 복습 진입 판정에 필요한 최소 필드. 목록(`NoteSummary`)과 상세(`getNoteById`)의
 * 반환 타입이 달라도 같은 판정을 쓸 수 있게 좁혀 둔다.
 */
export type ReviewGateNote = Pick<
  NoteSummary,
  "next_review_at" | "review_completed_at" | "review_round"
>;

function getKstDayNumber(date: Date): number {
  return Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_IN_MS);
}

export function getReviewStatus(note: ReviewGateNote): ReviewStatus {
  // 회차 상한이 없으므로 복습이 끝나는 경로는 사용자의 완료 표시뿐이다.
  if (note.review_completed_at) return "completed";
  if (!note.next_review_at) return "pending";
  if (new Date(note.next_review_at).getTime() <= Date.now()) return "available";
  return "scheduled";
}

/**
 * 백지 테스트에 진입할 수 있는지. 목록과 상세가 각자 판정하면 같은 노트가 화면마다
 * 다르게 보이므로 진입 조건은 여기서만 정한다.
 *
 * 예정일이 아직 안 왔든 오늘 이미 복습을 완료했든 진입은 막지 않는다 — 언제 복습할지는
 * 사용자가 정한다. 완료 처리가 가능한지는 별개 판정(`hasCompletedReviewForNoteToday`)이다.
 */
export function canStartReview(note: ReviewGateNote): boolean {
  return getReviewStatus(note) !== "completed" && note.next_review_at !== null;
}

/** KST 달력 날짜를 기준으로 복습 일정의 표시 문구와 강조 상태를 만든다. */
export function getReviewScheduleDisplay(
  status: ReviewStatus,
  nextReviewAt: string | null,
): ReviewScheduleDisplay {
  const defaultDisplay = (primaryText: string): ReviewScheduleDisplay => ({
    label: "다음 복습일",
    primaryText,
    tone: "default",
  });

  if (status === "completed") return defaultDisplay("완료");
  if (status === "pending") return defaultDisplay("준비 중");
  if (!nextReviewAt) return defaultDisplay("-");

  const nextReviewDate = new Date(nextReviewAt);
  const daysUntilReview =
    getKstDayNumber(nextReviewDate) - getKstDayNumber(new Date());

  if (daysUntilReview < 0) {
    return {
      label: "복습일",
      primaryText: `${Math.abs(daysUntilReview)}일 지남`,
      tone: "overdue",
    };
  }
  if (daysUntilReview === 0) {
    return { ...defaultDisplay("오늘"), tone: "today" };
  }
  if (daysUntilReview === 1) {
    return { ...defaultDisplay("내일"), tone: "upcoming" };
  }
  if (daysUntilReview <= 7) {
    return {
      ...defaultDisplay(`${daysUntilReview}일 후`),
      tone: "upcoming",
    };
  }
  return defaultDisplay(formatShortDateKST(nextReviewDate));
}
