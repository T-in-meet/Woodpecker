"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { requestRelatedNoteRecommendationAction } from "../actions";
import { relatedNotesQueryKeys } from "../constants/query-keys";
import { RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS } from "../execution/execution-claim-persistence";

type UseRequestRelatedNoteRecommendationOptions = {
  /**
   * 새 execution claim이 생성된 직후 호출됩니다.
   *
   * query invalidate보다 먼저 호출하여 Client가 해당 Claim ID를
   * polling 대상으로 등록한 뒤 최신 상태를 조회할 수 있도록 합니다.
   */
  onAccepted: (claimId: string) => void;
};

export function useRequestRelatedNoteRecommendation(
  noteId: string,
  { onAccepted }: UseRequestRelatedNoteRecommendationOptions,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await requestRelatedNoteRecommendationAction({
        noteId,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.execution;
    },

    onSuccess: async (execution) => {
      /*
       * 실제 새 Claim이 생성된 경우에만 이번 Claim ID를 polling 대상으로
       * 등록합니다.
       *
       * duplicate/stale/daily limit은 Provider 실행이 새로 시작되지 않으므로
       * 불필요한 110초 polling window를 열지 않습니다.
       */
      if (
        execution.status ===
        RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.CLAIMED
      ) {
        if (execution.claimId === null) {
          throw new Error("관련 노트 추천 실행 정보를 확인할 수 없습니다.");
        }

        onAccepted(execution.claimId);
      }

      /*
       * Claim 결과와 관계없이 최신 Related Notes, 실행 상태, quota를 다시 조회합니다.
       *
       * duplicate가 기존 running Claim을 가리키는 경우에는 이 조회를 통해
       * useRelatedNotes가 해당 실행을 발견하고 자동 polling을 시작합니다.
       *
       * duplicate가 기존 succeeded Claim을 가리키는 경우에는
       * 기존 결과를 그대로 표시하고 polling은 시작하지 않습니다.
       */
      await queryClient.invalidateQueries({
        queryKey: relatedNotesQueryKeys.byNoteId(noteId),
      });
    },
  });
}
