import type { AdminAppliedFilter } from "@/features/admin/types/filter";
import { createAdminClient } from "@/lib/supabase/admin";

import { nextDayIsoString, startOfDayIsoString } from "../../utils/query";
import type {
  AdminFeedbackListQuery,
  FeedbackFilterField,
} from "../types/feedback-list";

/**
 * 관리자 피드백 목록에 적용된 필터를 Supabase 조회 조건으로 변환합니다.
 *
 * @param feedbackQuery 조건을 적용할 feedbacks 조회 객체
 * @param filter 현재 적용할 관리자 필터
 * @returns 필터 조건이 반영된 feedbacks 조회 객체
 */
function applyFeedbackFilter(
  feedbackQuery: ReturnType<ReturnType<typeof createAdminClient>["from"]>,
  filter: AdminAppliedFilter<FeedbackFilterField>,
) {
  switch (filter.field) {
    case "category":
      if (filter.type === "multi-select") {
        return feedbackQuery.in("category", filter.value);
      }

      return feedbackQuery;

    case "status":
      if (filter.type === "multi-select") {
        return feedbackQuery.in("status", filter.value);
      }

      return feedbackQuery;

    case "createdAt": {
      if (filter.type !== "date-range") {
        return feedbackQuery;
      }

      const { from, to } = filter.value;

      if (from) {
        feedbackQuery = feedbackQuery.gte(
          "created_at",
          startOfDayIsoString(from),
        );
      }

      if (to) {
        feedbackQuery = feedbackQuery.lt("created_at", nextDayIsoString(to));
      }

      return feedbackQuery;
    }

    case "hasImages":
      if (filter.type === "select" && filter.value === "yes") {
        return feedbackQuery.not("image_urls", "eq", "{}");
      }

      if (filter.type === "select" && filter.value === "no") {
        return feedbackQuery.eq("image_urls", "{}");
      }

      return feedbackQuery;

    case "noteLinked":
      if (filter.type === "select" && filter.value === "yes") {
        return feedbackQuery.not("note_id", "is", null);
      }

      if (filter.type === "select" && filter.value === "no") {
        return feedbackQuery.is("note_id", null);
      }

      return feedbackQuery;

    default:
      return feedbackQuery;
  }
}

/**
 * 관리자 피드백 목록 조회 객체에 현재 적용된 모든 필터를 반영합니다.
 *
 * 값이 설정되지 않은 필터는 조회 조건에서 제외합니다.
 *
 * @param feedbackQuery 조건을 적용할 feedbacks 조회 객체
 * @param filters 목록 화면의 현재 필터 상태
 * @returns 모든 적용 필터가 반영된 feedbacks 조회 객체
 */
export function applyFeedbackFilters(
  feedbackQuery: ReturnType<ReturnType<typeof createAdminClient>["from"]>,
  filters: AdminFeedbackListQuery["filters"],
) {
  let filteredQuery = feedbackQuery;

  for (const filter of Object.values(filters)) {
    if (filter === undefined) {
      continue;
    }

    filteredQuery = applyFeedbackFilter(filteredQuery, filter);
  }

  return filteredQuery;
}
