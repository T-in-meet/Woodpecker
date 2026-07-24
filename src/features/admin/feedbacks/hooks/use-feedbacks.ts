import { useQuery } from "@tanstack/react-query";

import { getFeedbacks } from "../queries";
import type { AdminFeedbackListQuery } from "../types/feedback-list";

/**
 * 관리자 피드백 목록 query key factory입니다.
 */
export const ADMIN_FEEDBACKS_QUERY_KEY = {
  all: ["admin-feedbacks"] as const,

  list: (query: AdminFeedbackListQuery) =>
    [...ADMIN_FEEDBACKS_QUERY_KEY.all, "list", query] as const,
};

/**
 * 검색, 필터, 페이지네이션 조건에 맞는 관리자 피드백 목록을 조회합니다.
 *
 * @param query 목록 조회 조건
 */
export function useFeedbacks(query: AdminFeedbackListQuery) {
  return useQuery({
    queryKey: ADMIN_FEEDBACKS_QUERY_KEY.list(query),
    queryFn: () => getFeedbacks(query),
    placeholderData: (previousData) => previousData,
  });
}
