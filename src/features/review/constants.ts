import { SHARED_AI_FAILURE_MESSAGES } from "@/lib/ai/failureMessages";

export const GRADING_ERROR_MESSAGES = {
  // 아래 두 개의 실제 한도 값은 claim_review_grading 함수가 가지고 있다.
  dailyExceeded:
    "오늘 받을 수 있는 AI 채점을 모두 사용했어요. 내일 다시 시도해주세요.",
  inFlight: "채점이 진행 중이에요. 잠시 후 다시 시도해주세요.",
} as const;

/**
 * AI 호출 실패 이유별 문구.
 *
 * `dailyExceeded`(사용자별 한도)와 `quotaExhausted`(서비스 전체 한도)는 다른 상태다.
 * 전자는 이 사용자만, 후자는 모두가 막힌다. 초기화 시점도 다르다 —
 * 사용자별 한도는 KST 자정, Cloudflare 무료 할당은 00:00 UTC(KST 오전 9시)다.
 * 그래서 후자에는 "내일"이라고 쓰지 않는다.
 */
export const GRADING_AI_FAILURE_MESSAGES = {
  ...SHARED_AI_FAILURE_MESSAGES,
  tooLarge: "노트나 답안이 너무 길어 AI가 처리할 수 없어요.",
  unknown: "AI 채점에 실패했습니다. 잠시 후 다시 시도해주세요.",
} as const;
