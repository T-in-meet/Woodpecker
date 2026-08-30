"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateNoteChatConversationTitleAction } from "../actions";
import { noteChatQueryKeys } from "../constants/query-keys";

type UpdateNoteChatConversationTitleMutationInput = {
  conversationId: string;
  title: string;
};

/**
 * 노트 챗봇 Conversation 제목을 수정하는 Mutation입니다.
 */
export function useUpdateNoteChatConversationTitleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateNoteChatConversationTitleMutationInput) => {
      const result = await updateNoteChatConversationTitleAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.conversation;
    },

    onSuccess: async (conversation) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: noteChatQueryKeys.conversationLists(),
        }),
        queryClient.invalidateQueries({
          queryKey: noteChatQueryKeys.conversationDetail(conversation.id),
        }),
      ]);
    },
  });
}
