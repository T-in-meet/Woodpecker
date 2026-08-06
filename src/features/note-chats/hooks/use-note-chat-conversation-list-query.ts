"use client";

import { useQuery } from "@tanstack/react-query";

import { noteChatQueryKeys } from "../constants/query-keys";
import { getNoteChatConversationList } from "../queries";

/**
 * 노트 챗봇 대화 목록 Query입니다.
 */
export function useNoteChatConversationListQuery() {
  return useQuery({
    queryKey: noteChatQueryKeys.conversationList(),
    queryFn: getNoteChatConversationList,
  });
}
