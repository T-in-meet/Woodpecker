import type { FeedbackCategory, FeedbackStatus } from "../types/feedback-list";

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  BUG: "버그",
  FEATURE: "기능 요청",
  ETC: "기타",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  OPEN: "미해결",
  RESOLVED: "해결",
};
