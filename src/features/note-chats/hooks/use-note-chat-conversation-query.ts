"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { noteChatQueryKeys } from "../constants/query-keys";
import {
  getNoteChatConversationDetail,
  getNoteChatConversationMessagePage,
} from "../queries";

const NOTE_CHAT_RUNNING_EXECUTION_POLLING_INTERVAL_MS = 5_000;

/**
 * 노트 챗봇 대화 상세 Query입니다.
 *
 * Conversation과 실행 상태를 조회합니다.
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

/**
 * 노트 챗봇 대화 메시지 무한 Query입니다.
 *
 * 최초 페이지는 최신 메시지를 조회하고,
 * 다음 페이지는 현재 가장 오래된 메시지 이전 데이터를 조회합니다.
 */
export function useNoteChatConversationMessagesQuery(conversationId: string) {
  return useInfiniteQuery({
    queryKey: noteChatQueryKeys.conversationMessages(conversationId),
    queryFn: ({ pageParam }) =>
      getNoteChatConversationMessagePage({
        conversationId,
        cursor: pageParam,
      }),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    enabled: Boolean(conversationId),
  });
}
