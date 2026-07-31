import { useQuery } from "@tanstack/react-query";

import { getFeedbackDetail } from "../queries";

/**
 * 관리자 피드백 상세 조회 query key factory입니다.
 */
export const ADMIN_FEEDBACK_DETAIL_QUERY_KEY = {
  all: ["admin-feedback-detail"] as const,

  detail: (feedbackId: string) =>
    [...ADMIN_FEEDBACK_DETAIL_QUERY_KEY.all, feedbackId] as const,
};

/**
 * 관리자 피드백 상세 데이터를 Server Action으로 조회합니다.
 *
 * @param feedbackId 조회할 feedbacks.id
 */
export function useFeedbackDetail(feedbackId: string) {
  return useQuery({
    queryKey: ADMIN_FEEDBACK_DETAIL_QUERY_KEY.detail(feedbackId),
    queryFn: () => getFeedbackDetail(feedbackId),
  });
}
