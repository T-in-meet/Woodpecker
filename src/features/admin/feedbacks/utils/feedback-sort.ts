import type { AdminSort } from "@/features/admin/types/sort";
import { createAdminClient } from "@/lib/supabase/admin";

import { ADMIN_SORT_DIRECTION } from "../../constants/admin-sort";
import { ADMIN_FEEDBACK_SORT_COLUMN } from "../constants/feedback-list";
import type { FeedbackSortField } from "../types/feedback-list";

/**
 * 관리자 피드백 목록의 정렬 조건을 Supabase 조회에 적용합니다.
 *
 * feedbacks 테이블에서 직접 정렬할 수 있는 필드는
 * 대응하는 실제 컬럼을 기준으로 정렬합니다.
 *
 * 아직 직접 정렬을 지원하지 않는 관계 데이터 및 계산 필드는
 * 등록일 내림차순을 기본 정렬로 사용합니다.
 *
 * @param feedbackQuery 정렬 조건을 적용할 feedbacks 조회 객체
 * @param sort 현재 적용된 관리자 정렬 조건
 * @returns 정렬 조건이 반영된 feedbacks 조회 객체
 */
export function applyFeedbackSort(
  feedbackQuery: ReturnType<ReturnType<typeof createAdminClient>["from"]>,
  sort: AdminSort<FeedbackSortField>,
) {
  const sortColumn = ADMIN_FEEDBACK_SORT_COLUMN[sort.field];

  return feedbackQuery.order(sortColumn, {
    ascending: sort.direction === ADMIN_SORT_DIRECTION.ASC,
  });
}
