import "server-only";

import { createClient } from "@/lib/supabase/server";

import type {
  NoteChatConversationDetail,
  NoteChatConversationListItem,
} from "./types";

/**
 * 현재 사용자의 노트 챗봇 대화 목록을 조회합니다.
 *
 * 대화 목록 View를 사용하며, 최근 수정된 대화를 먼저 반환합니다.
 * 사용자 소유권은 View와 기반 테이블에 적용된 RLS로 제한합니다.
 */
export async function getNoteChatConversationList(): Promise<
  NoteChatConversationListItem[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("note_chat_conversation_list")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(
      `노트 챗봇 대화 목록 조회에 실패했습니다: ${error.message}`,
    );
  }

  return data;
}

/**
 * 현재 사용자의 노트 챗봇 대화 상세를 조회합니다.
 *
 * 대화 기본 정보와 해당 대화의 전체 메시지를 함께 반환합니다.
 * 메시지는 대화 순서대로 표시할 수 있도록 `sequence_number` 오름차순으로 정렬합니다.
 *
 * @param conversationId 조회할 대화 ID
 * @returns 대화가 없거나 현재 사용자가 접근할 수 없으면 `null`
 */
export async function getNoteChatConversationDetail(
  conversationId: string,
): Promise<NoteChatConversationDetail | null> {
  const supabase = await createClient();

  const { data: conversation, error: conversationError } = await supabase
    .from("note_chat_conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    throw new Error(
      `노트 챗봇 대화 조회에 실패했습니다: ${conversationError.message}`,
    );
  }

  if (!conversation) {
    return null;
  }

  const { data: messages, error: messagesError } = await supabase
    .from("note_chat_messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("sequence_number", { ascending: true });

  if (messagesError) {
    throw new Error(
      `노트 챗봇 메시지 조회에 실패했습니다: ${messagesError.message}`,
    );
  }

  return {
    conversation,
    messages,
  };
}
