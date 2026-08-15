export const GRADING_ERROR_MESSAGES = {
  // 아래 세 개의 실제 한도 값은 claim_review_grading 함수가 가지고 있다.
  dailyExceeded:
    "오늘 받을 수 있는 AI 채점을 모두 사용했어요. 내일 다시 시도해주세요.",
  tooManyRequests: "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.",
  inFlight: "채점이 진행 중이에요. 잠시 후 다시 시도해주세요.",
} as const;
