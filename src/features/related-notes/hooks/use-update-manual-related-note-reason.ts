"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateManualRelatedNoteReasonAction } from "../actions";
import { relatedNotesQueryKeys } from "../constants/query-keys";

type UpdateManualRelatedNoteReasonVariables = {
  /** 현재 보고 있는 기준 Note ID입니다. */
  noteId: string;

  /** reason을 수정할 manual Related Notes 관계 row ID입니다. */
  relationId: string;

  /** 수정할 선택적 연결 이유입니다. */
  reason?: string;
};

/**
 * manual Related Note의 선택적 reason 수정 mutation을 제공합니다.
 *
 * 수정 성공 후 현재 Note의 Related Notes 목록을 다시 조회하여
 * 변경된 reason이 화면에 즉시 반영되도록 합니다.
 */
export function useUpdateManualRelatedNoteReason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: UpdateManualRelatedNoteReasonVariables) => {
      const result = await updateManualRelatedNoteReasonAction(variables);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },

    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: relatedNotesQueryKeys.byNoteId(variables.noteId),
      });
    },
  });
}
