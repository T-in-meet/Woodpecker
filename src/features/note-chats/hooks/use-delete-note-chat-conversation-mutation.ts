"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteNoteChatConversationAction } from "../actions";
import { noteChatQueryKeys } from "../constants/query-keys";

export function useDeleteNoteChatConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const result = await deleteNoteChatConversationAction({
        conversationId,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.conversationId;
    },

    onSuccess: async (conversationId) => {
      queryClient.removeQueries({
        queryKey: noteChatQueryKeys.conversationDetail(conversationId),
      });

      await queryClient.invalidateQueries({
        queryKey: noteChatQueryKeys.conversationLists(),
      });
    },
  });
}
