// 클라이언트 훅도 쓰는 값이라 execution-claim-persistence.ts(관리자 클라이언트·zod 사용)와 분리한다.

/** Related Notes 추천 실행 claim 상태입니다. */
export const RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS = {
  CLAIMED: "claimed",
  DAILY_LIMIT_EXCEEDED: "daily_limit_exceeded",
  DUPLICATE: "duplicate",
  STALE: "stale",
} as const;

/** Related Notes 추천 실행 claim 상태 타입입니다. */
export type RelatedNoteRecommendationExecutionClaimStatus =
  (typeof RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS)[keyof typeof RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS];
