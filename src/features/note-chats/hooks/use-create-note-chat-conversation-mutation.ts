"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createNoteChatConversationAction } from "../actions";
import { noteChatQueryKeys } from "../constants/query-keys";

/**
 * 새로운 노트 챗봇 Conversation을 생성하는 Mutation입니다.
 *
 * 생성 성공 후 Conversation 목록 Query를 무효화하여
 * 새 Conversation이 목록에 반영되도록 합니다.
 */
export function useCreateNoteChatConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string) => {
      const result = await createNoteChatConversationAction({
        title,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.conversation;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: noteChatQueryKeys.conversationLists(),
      });
    },
  });
}
