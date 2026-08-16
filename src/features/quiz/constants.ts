export const QUIZ_ERROR_MESSAGES = {
  invalidNote: "유효하지 않은 노트입니다.",
  invalidQuizType: "유효하지 않은 퀴즈 유형입니다.",
  unauthenticated: "로그인이 필요합니다.",
  noteNotFound: "노트를 찾을 수 없습니다.",
  generationFailed: "퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
  serverDelayed: "서버 응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.",
  parseFailed: "퀴즈 생성 결과를 처리할 수 없습니다. 다시 시도해주세요.",
  // 아래 세 개의 실제 한도 값은 claim_quiz_generation_v2 함수가 가지고 있다.
  dailyExceeded:
    "오늘 AI 퀴즈 생성 횟수를 모두 사용했습니다. 기존 퀴즈는 다시 풀 수 있어요.",
  tooManyRequests: "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.",
  inFlight: "퀴즈를 만들고 있습니다. 잠시만 기다려주세요.",
  // finalize_quiz_generation_v2가 stale_claim을 반환할 때. 다른 요청이 먼저
  // 선점을 이어받아 이 응답은 캐시에 저장하지 않고 버린다.
  staleClaim:
    "다른 퀴즈 생성 요청이 먼저 진행됐어요. 잠시 후 다시 시도해주세요.",
} as const;

/**
 * AI 호출 실패 이유별 문구.
 *
 * `dailyExceeded`(사용자별 한도)와 `quotaExhausted`(서비스 전체 한도)는 다른 상태다.
 * 전자는 이 사용자만, 후자는 모두가 막힌다. 초기화 시점도 다르다 —
 * 사용자별 한도는 KST 자정, Cloudflare 무료 할당은 00:00 UTC(KST 오전 9시)다.
 * 둘을 같은 문구로 뭉치면 "내일 다시"라고 안내해 놓고 9시에 풀리는 상황이 생긴다.
 */
export const QUIZ_AI_FAILURE_MESSAGES = {
  delayed: "AI 응답이 지연됐어요. 다시 시도해주세요.",
  quotaExhausted:
    "서비스의 오늘 AI 사용량이 모두 소진됐어요. 잠시 후 다시 시도해주세요.",
  busy: "AI 서버가 혼잡해요. 잠시 후 다시 시도해주세요.",
  tooLarge: "노트가 너무 길어 AI가 처리할 수 없어요.",
  unknown: QUIZ_ERROR_MESSAGES.generationFailed,
} as const;
