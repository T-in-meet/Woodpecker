"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addManualRelatedNotesAction } from "../actions";
import { relatedNotesQueryKeys } from "../constants/query-keys";

type AddManualRelatedNotesVariables = {
  /** 현재 보고 있는 기준 Note ID입니다. */
  noteId: string;

  /** 수동으로 연결할 Related Notes 목록입니다. */
  relatedNotes: Array<{
    /** 수동으로 연결할 Related Note ID입니다. */
    relatedNoteId: string;

    /** 사용자가 입력한 선택적 연결 이유입니다. */
    reason?: string;
  }>;
};

/**
 * manual Related Notes 일괄 추가 mutation을 제공합니다.
 *
 * 추가 성공 후에는:
 *
 * - 현재 Note의 Related Notes 목록
 * - 수동 추가 후보 목록
 *
 * 을 다시 조회하도록 invalidate합니다.
 *
 * 새로 추가된 Notes는 즉시 Related Notes 목록에 나타나야 하고,
 * 동시에 후보 목록에서는 제외되어야 하기 때문입니다.
 */
export function useAddManualRelatedNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: AddManualRelatedNotesVariables) => {
      const result = await addManualRelatedNotesAction(variables);

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
