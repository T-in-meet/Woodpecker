"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteRelatedNoteAction } from "../actions";
import { relatedNotesQueryKeys } from "../constants/query-keys";

type DeleteRelatedNoteVariables = {
  /** 현재 보고 있는 기준 Note ID입니다. */
  noteId: string;

  /** 삭제할 Related Notes 관계 row ID입니다. */
  relationId: string;
};

/**
 * Related Note 삭제 mutation을 제공합니다.
 *
 * 삭제 성공 후에는:
 *
 * - 현재 Note의 Related Notes 목록
 * - 수동 추가 후보 목록
 *
 * 을 다시 조회하도록 invalidate합니다.
 *
 * manual 관계가 삭제되면 다시 수동 추가 후보가 될 수 있고,
 * AI 관계는 dismissed 처리되어 현재 목록에서 제외되어야 하기 때문입니다.
 */
export function useDeleteRelatedNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: DeleteRelatedNoteVariables) => {
      const result = await deleteRelatedNoteAction(variables);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },

    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: relatedNotesQueryKeys.byNoteId(variables.noteId),
        }),
        queryClient.invalidateQueries({
          queryKey: relatedNotesQueryKeys.candidateList(variables.noteId),
        }),
      ]);
    },
  });
}
