import { ADMIN_USER_SORT_COLUMN } from "../constants/user-list";
import type { AdminUserListQuery } from "../types/user-list";
import type { AdminUserListQueryBuilder } from "./user-query";

/**
 * 관리자 사용자 목록 조회 객체에 현재 정렬 조건을 적용합니다.
 *
 * @param userQuery 정렬 조건을 적용할 admin_user_list View 조회 객체
 * @param sort 현재 적용된 관리자 목록 정렬 조건
 * @returns 정렬 조건이 반영된 사용자 목록 조회 객체
 */
export function applyUserSort(
  userQuery: AdminUserListQueryBuilder,
  sort: AdminUserListQuery["sort"],
) {
  const column = ADMIN_USER_SORT_COLUMN[sort.field];

  return userQuery.order(column, {
    ascending: sort.direction === "asc",
  });
}
