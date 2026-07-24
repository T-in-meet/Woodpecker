import type { FeedbackCategory, FeedbackStatus } from "../types/feedback-list";

/**
 * 피드백 카테고리 DB 값을 관리자 화면 표시 문구로 변환하는 label map입니다.
 */
export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  BUG: "버그",
  FEATURE: "기능 요청",
  ETC: "기타",
};

/**
 * 피드백 상태 DB 값을 관리자 화면 표시 문구로 변환하는 label map입니다.
 */
export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  OPEN: "미해결",
  RESOLVED: "해결",
};
