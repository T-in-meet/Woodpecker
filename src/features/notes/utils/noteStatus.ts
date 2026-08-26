import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
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

function getKstDayNumber(date: Date): number {
  return Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_IN_MS);
}

export function getReviewStatus(note: NoteSummary): ReviewStatus {
  if (note.review_round >= MAX_REVIEW_ROUND && note.next_review_at === null)
    return "completed";
  if (!note.next_review_at) return "pending";
  if (new Date(note.next_review_at).getTime() <= Date.now()) return "available";
  return "scheduled";
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
