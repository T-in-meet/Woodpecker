"use client";

import { useQuery } from "@tanstack/react-query";

import { noteChatQueryKeys } from "../constants/query-keys";
import { getNoteChatConversationList } from "../queries";

type UseNoteChatConversationListQueryParams = {
  page?: number;
  search?: string;
};

/**
 * 노트 챗봇 대화 목록 Query입니다.
 *
 * 검색 및 페이지 조건을 전달하지 않으면
 * 첫 번째 페이지의 전체 대화 목록을 조회합니다.
 */
export function useNoteChatConversationListQuery({
  page = 1,
  search = "",
}: UseNoteChatConversationListQueryParams = {}) {
  return useQuery({
    queryKey: noteChatQueryKeys.conversationList({
      page,
      search,
    }),
    queryFn: () =>
      getNoteChatConversationList({
        page,
        search,
      }),
  });
}
