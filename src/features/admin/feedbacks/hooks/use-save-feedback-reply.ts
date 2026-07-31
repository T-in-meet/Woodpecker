import { useMutation, useQueryClient } from "@tanstack/react-query";

import { saveFeedbackReply } from "../actions";
import { ADMIN_FEEDBACK_DETAIL_QUERY_KEY } from "./use-feedback-detail";
import { ADMIN_FEEDBACKS_QUERY_KEY } from "./use-feedbacks";

type SaveFeedbackReplyVariables = {
  /** 답변을 저장할 feedbacks.id */
  feedbackId: string;

  /** Server Action에 전달할 답변 form payload */
  formData: FormData;
};

/**
 * 관리자 답변 저장 mutation입니다.
 *
 * 저장 성공 시 상세 화면의 답변과 목록 화면의 상태 badge가 함께 갱신되도록
 * 상세 query와 목록 query를 모두 무효화합니다.
 */
export function useSaveFeedbackReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId, formData }: SaveFeedbackReplyVariables) =>
      saveFeedbackReply(feedbackId, formData),
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ADMIN_FEEDBACK_DETAIL_QUERY_KEY.detail(
            variables.feedbackId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: ADMIN_FEEDBACKS_QUERY_KEY.all,
        }),
      ]);
    },
  });
}
