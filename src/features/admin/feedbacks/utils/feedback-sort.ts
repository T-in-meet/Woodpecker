import type { AdminSort } from "@/features/admin/types/sort";
import { createAdminClient } from "@/lib/supabase/admin";

import { ADMIN_SORT_DIRECTION } from "../../constants/admin-sort";
import { ADMIN_FEEDBACK_SORT_COLUMN } from "../constants/feedback-list";
import type {
  AdminFeedbackListItem,
  FeedbackSortField,
} from "../types/feedback-list";

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

  if (sortColumn === undefined) {
    return feedbackQuery;
  }

  return feedbackQuery.order(sortColumn, {
    ascending: sort.direction === ADMIN_SORT_DIRECTION.ASC,
  });
}

/**
 * feedbacks 컬럼만으로 정렬할 수 없는 목록 표시 필드인지 확인합니다.
 */
export function needsFeedbackItemSort(sort: AdminSort<FeedbackSortField>) {
  return ADMIN_FEEDBACK_SORT_COLUMN[sort.field] === undefined;
}

/**
 * 관계 데이터 또는 계산값으로 만든 목록 표시 필드를 정렬합니다.
 */
export function sortFeedbackItems(
  items: AdminFeedbackListItem[],
  sort: AdminSort<FeedbackSortField>,
): AdminFeedbackListItem[] {
  return [...items].sort((left, right) => {
    const compareResult = compareFeedbackItems(left, right, sort.field);

    if (compareResult !== 0) {
      return sort.direction === ADMIN_SORT_DIRECTION.ASC
        ? compareResult
        : -compareResult;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function compareFeedbackItems(
  left: AdminFeedbackListItem,
  right: AdminFeedbackListItem,
  field: FeedbackSortField,
) {
  switch (field) {
    case "user":
      return compareText(left.userLabel, right.userLabel);

    case "imageCount":
      return left.imageCount - right.imageCount;

    case "replyAuthor":
      return compareNullableText(left.replyAuthorLabel, right.replyAuthorLabel);

    case "note":
      return compareNullableText(left.noteTitle, right.noteTitle);

    case "status":
      return compareText(left.status, right.status);

    case "category":
      return compareText(left.category, right.category);

    case "title":
      return compareText(left.title, right.title);

    case "createdAt":
      return left.createdAt.localeCompare(right.createdAt);

    default:
      return assertNever(field);
  }
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "ko-KR");
}

function compareNullableText(left: string | null, right: string | null) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  return compareText(left, right);
}

function assertNever(value: never): never {
  throw new Error(`지원하지 않는 피드백 정렬 필드입니다: ${value}`);
}
