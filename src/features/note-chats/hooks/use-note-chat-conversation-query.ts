"use client";

import { useQuery } from "@tanstack/react-query";

import { noteChatQueryKeys } from "../constants/query-keys";
import { getNoteChatConversationDetail } from "../queries";

/**
 * 노트 챗봇 대화 상세 Query입니다.
 *
 * Conversation과 Messages를 함께 조회합니다.
 */
export function useNoteChatConversationDetailQuery(conversationId: string) {
  return useQuery({
    queryKey: noteChatQueryKeys.conversationDetail(conversationId),
    queryFn: () => getNoteChatConversationDetail(conversationId),
    enabled: Boolean(conversationId),
  });
}
