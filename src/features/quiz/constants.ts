export const QUIZ_ERROR_MESSAGES = {
  invalidNote: "유효하지 않은 노트입니다.",
  invalidQuizType: "유효하지 않은 퀴즈 유형입니다.",
  unauthenticated: "로그인이 필요합니다.",
  noteNotFound: "노트를 찾을 수 없습니다.",
  generationFailed: "퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
  parseFailed: "퀴즈 생성 결과를 처리할 수 없습니다. 다시 시도해주세요.",
  // 아래 세 개의 실제 한도 값은 claim_quiz_generation 함수가 가지고 있다.
  dailyExceeded:
    "오늘 만들 수 있는 퀴즈를 모두 사용했습니다. 내일 다시 시도해주세요.",
  tooManyRequests: "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.",
  inFlight: "퀴즈를 만들고 있습니다. 잠시만 기다려주세요.",
} as const;
