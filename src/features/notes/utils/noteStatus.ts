import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { formatShortDateKST } from "@/lib/utils/formatDate";

import type { NoteSummary } from "../queries";

export type ReviewStatus = "available" | "completed" | "scheduled" | "pending";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

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

/** 가까운 일정은 KST 달력 날짜 기준 상대 표현을, 그 이후는 짧은 날짜를 쓴다. */
export function getNextReviewText(
  status: ReviewStatus,
  nextReviewAt: string | null,
): string {
  if (status === "completed") return "완료";
  if (status === "pending") return "준비 중";
  if (!nextReviewAt) return "-";

  const nextReviewDate = new Date(nextReviewAt);
  const daysUntilReview =
    getKstDayNumber(nextReviewDate) - getKstDayNumber(new Date());

  if (daysUntilReview < 0) return formatShortDateKST(nextReviewDate);
  if (daysUntilReview === 0) return "오늘";
  if (daysUntilReview === 1) return "내일";
  if (daysUntilReview <= 7) return `${daysUntilReview}일 후`;
  return formatShortDateKST(nextReviewDate);
}
