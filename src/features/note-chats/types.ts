import type { Database } from "@/types/database.types";

import type { AiChatMessageContent } from "../ai/chats/types";

/** 노트 챗봇 대화 DB Row 타입입니다. */
export type NoteChatConversation =
  Database["public"]["Tables"]["note_chat_conversations"]["Row"];

/** 노트 챗봇 메시지 DB Row 타입입니다. */
export type NoteChatMessage =
  Database["public"]["Tables"]["note_chat_messages"]["Row"];

/** 노트 챗봇 실행 DB Row 타입입니다. */
export type NoteChatRun = Database["public"]["Tables"]["note_chat_runs"]["Row"];

/** 사용자 대화 목록 View Row 타입입니다. */
export type NoteChatConversationListItem =
  Database["public"]["Views"]["note_chat_conversation_list"]["Row"];

/** 사용자 메시지의 JSON 콘텐츠 타입입니다. */
export type NoteChatUserMessageContent = AiChatMessageContent;

/**
 * AI 답변 메시지의 JSON 콘텐츠 타입입니다.
 *
 * `usedNoteIds`에는 LLM이 실제 답변 생성에 사용한 노트 ID를 저장합니다.
 */
export type NoteChatAssistantMessageContent = AiChatMessageContent & {
  usedNoteIds: string[];
};

/** 노트 챗봇 대화 상세 조회 결과입니다. */
export type NoteChatConversationDetail = {
  conversation: NoteChatConversation;
  hasRunningExecution: boolean;
};

/** 노트 챗봇 AI 실행에 필요한 대화와 제한된 메시지 이력입니다. */
export type NoteChatConversationExecutionDetail = NoteChatConversationDetail & {
  messages: NoteChatMessage[];
};

/** 노트 챗봇 메시지 페이지 조회 결과입니다. */
export type NoteChatMessagePage = {
  messages: NoteChatMessage[];
  assistantSources: NoteChatAssistantSources[];
  nextCursor: number | null;
};

/** 노트 챗봇 메시지 페이지 조회 입력입니다. */
export type NoteChatMessagePageParams = {
  conversationId: string;
  cursor?: number | null;
};

/** 노트 챗봇 참고 노트 출처입니다. */
export type NoteChatUsedNoteSource = {
  noteId: string;
  title: string;
};

/** Assistant 메시지별 노트 챗봇 참고 노트 출처입니다. */
export type NoteChatAssistantSources = {
  assistantMessageId: string;
  sources: NoteChatUsedNoteSource[];
};
