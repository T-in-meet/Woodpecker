/**
 * AI 메시지 작성자 역할입니다.
 */
export const AI_CHAT_MESSAGE_ROLE = {
  USER: "user",
  ASSISTANT: "assistant",
} as const;

/**
 * AI 메시지 작성자 역할 표시명입니다.
 */
export const AI_CHAT_MESSAGE_ROLE_LABEL = {
  [AI_CHAT_MESSAGE_ROLE.USER]: "사용자",
  [AI_CHAT_MESSAGE_ROLE.ASSISTANT]: "AI",
} satisfies Record<
  (typeof AI_CHAT_MESSAGE_ROLE)[keyof typeof AI_CHAT_MESSAGE_ROLE],
  string
>;

/**
 * AI 실행 상태입니다.
 */
export const AI_RUN_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
} as const;

/**
 * AI 실행 상태 표시명입니다.
 */
export const AI_RUN_STATUS_LABEL = {
  [AI_RUN_STATUS.PENDING]: "대기",
  [AI_RUN_STATUS.RUNNING]: "실행 중",
  [AI_RUN_STATUS.SUCCEEDED]: "성공",
  [AI_RUN_STATUS.FAILED]: "실패",
} satisfies Record<(typeof AI_RUN_STATUS)[keyof typeof AI_RUN_STATUS], string>;
