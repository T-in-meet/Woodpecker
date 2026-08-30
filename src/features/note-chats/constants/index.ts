/**
 * 노트 챗봇 대화 제목 최대 길이입니다.
 *
 * DB의 CHECK 제약조건과 동일한 값을 사용합니다.
 */
export const NOTE_CHAT_CONVERSATION_TITLE_MAX_LENGTH = 50;

/**
 * 사용자가 입력할 수 있는 질문 최대 길이입니다.
 *
 * 애플리케이션 입력 정책으로 사용합니다.
 */
export const NOTE_CHAT_QUESTION_MAX_LENGTH = 10_000;

/**
 * 노트 챗봇 입력 검증 메시지입니다.
 */
export const NOTE_CHAT_VALIDATION_MESSAGE = {
  TITLE_REQUIRED: "대화 제목을 입력해 주세요.",
  TITLE_MAX_LENGTH: `대화 제목은 ${NOTE_CHAT_CONVERSATION_TITLE_MAX_LENGTH}자 이하로 입력해 주세요.`,

  QUESTION_REQUIRED: "질문을 입력해 주세요.",
  QUESTION_MAX_LENGTH: `질문은 ${NOTE_CHAT_QUESTION_MAX_LENGTH}자 이하로 입력해 주세요.`,

  ASSISTANT_MESSAGE_REQUIRED: "AI 답변 내용이 비어 있습니다.",

  CONVERSATION_ID_INVALID: "올바른 대화 ID가 아닙니다.",
  MESSAGE_ID_INVALID: "올바른 메시지 ID가 아닙니다.",
  AI_SETTING_ID_INVALID: "올바른 AI 설정 ID가 아닙니다.",
} as const;
