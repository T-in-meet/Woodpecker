"use client";

import { useQuery } from "@tanstack/react-query";

import { noteChatQueryKeys } from "../constants/query-keys";
import { getNoteChatConversationDetail } from "../queries";

const NOTE_CHAT_RUNNING_EXECUTION_POLLING_INTERVAL_MS = 5_000;

/**
 * 노트 챗봇 대화 상세 Query입니다.
 *
 * Conversation과 Messages를 함께 조회합니다.
 * 실행 중인 Claim이 있으면 완료 상태를 놓치지 않도록 polling합니다.
 */
export function useNoteChatConversationDetailQuery(conversationId: string) {
  return useQuery({
    queryKey: noteChatQueryKeys.conversationDetail(conversationId),
    queryFn: () => getNoteChatConversationDetail(conversationId),
    enabled: Boolean(conversationId),
    refetchInterval: (query) =>
      query.state.data?.hasRunningExecution
        ? NOTE_CHAT_RUNNING_EXECUTION_POLLING_INTERVAL_MS
        : false,
  });
}
