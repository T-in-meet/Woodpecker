import type { Database } from "@/types/database.types";

import { AiChatMessageContent } from "../ai/chats/types";

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
 * `referencedNoteRanks`에는 실제 답변에서 참고한 Context 노트 순위를 저장합니다.
 */
export type NoteChatAssistantMessageContent = AiChatMessageContent & {
  referencedNoteRanks: number[];
};

/** 노트 챗봇 대화 상세 조회 결과입니다. */
export type NoteChatConversationDetail = {
  conversation: NoteChatConversation;
  messages: NoteChatMessage[];
};
