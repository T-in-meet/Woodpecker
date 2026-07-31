import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteFeedbackReply } from "../actions";
import { ADMIN_FEEDBACK_DETAIL_QUERY_KEY } from "./use-feedback-detail";
import { ADMIN_FEEDBACKS_QUERY_KEY } from "./use-feedbacks";

/**
 * 관리자 답변 삭제 mutation입니다.
 *
 * 삭제 성공 시 상세 화면의 답변 섹션과 목록 화면의 상태 badge가 함께 갱신되도록
 * 상세 query와 목록 query를 모두 무효화합니다.
 */
export function useDeleteFeedbackReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedbackId: string) => deleteFeedbackReply(feedbackId),
    onSuccess: async (result, feedbackId) => {
      if (!result.ok) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ADMIN_FEEDBACK_DETAIL_QUERY_KEY.detail(feedbackId),
        }),
        queryClient.invalidateQueries({
          queryKey: ADMIN_FEEDBACKS_QUERY_KEY.all,
        }),
      ]);
    },
  });
}
