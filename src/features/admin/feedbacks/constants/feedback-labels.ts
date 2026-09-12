import type {
  FeedbackArea,
  FeedbackCategory,
  FeedbackStatus,
} from "../types/feedback-list";

/**
 * 피드백 카테고리 DB 값을 관리자 화면 표시 문구로 변환하는 label map입니다.
 */
export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  BUG: "버그",
  FEATURE: "기능 요청",
  ETC: "기타",
};

/**
 * 피드백 영역 DB 값을 관리자 화면 표시 문구로 변환하는 label map입니다.
 *
 * 사용자 화면 문구(FEEDBACK_AREA_LABELS in features/mypage/schema.ts)보다
 * 짧게 줄여 목록 배지와 필터에서 폭을 적게 차지하도록 한다.
 */
export const FEEDBACK_AREA_LABELS: Record<FeedbackArea, string> = {
  NOTE: "노트",
  REVIEW: "복습",
  AI: "AI",
  NOTIFICATION: "알림",
  ACCOUNT: "계정",
  ETC: "기타",
};

/**
 * 피드백 상태 DB 값을 관리자 화면 표시 문구로 변환하는 label map입니다.
 */
export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  OPEN: "미해결",
  RESOLVED: "해결",
};
