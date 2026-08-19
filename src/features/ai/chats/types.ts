import { AI_CHAT_MESSAGE_ROLE, AI_RUN_STATUS } from "./constants";

/** AI 채팅 메시지 작성자 역할입니다. */
export type AiChatMessageRole =
  (typeof AI_CHAT_MESSAGE_ROLE)[keyof typeof AI_CHAT_MESSAGE_ROLE];

/** AI 채팅 실행 상태입니다. */
export type AiRunStatus = (typeof AI_RUN_STATUS)[keyof typeof AI_RUN_STATUS];

/** 모든 AI 채팅 메시지 콘텐츠가 공통으로 갖는 필드입니다. */
export type AiChatMessageContent = {
  text: string;
};
