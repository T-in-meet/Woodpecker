import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { formatShortDateKST } from "@/lib/utils/formatDate";

import type { NoteSummary } from "../queries";

export type ReviewStatus = "available" | "completed" | "scheduled" | "pending";

export function getReviewStatus(note: NoteSummary): ReviewStatus {
  if (note.review_round >= MAX_REVIEW_ROUND && note.next_review_at === null)
    return "completed";
  if (!note.next_review_at) return "pending";
  if (new Date(note.next_review_at).getTime() <= Date.now()) return "available";
  return "scheduled";
}

/** 목록(카드형·리스트형) 공통. 좁은 폭에서 줄바꿈되지 않도록 짧은 날짜 형식을 쓴다. */
export function getNextReviewText(
  status: ReviewStatus,
  nextReviewAt: string | null,
): string {
  if (status === "completed") return "완료";
  if (status === "pending") return "준비 중";
  if (nextReviewAt) return formatShortDateKST(nextReviewAt);
  return "-";
}
