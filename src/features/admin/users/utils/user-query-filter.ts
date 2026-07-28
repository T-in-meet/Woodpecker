import type { AdminAppliedFilter } from "@/features/admin/types/filter";

import type { AdminUserListQuery, UserFilterField } from "../types/user-list";
import {
  type AdminUserListQueryBuilder,
  nextDayIsoString,
  startOfDayIsoString,
} from "./user-query";

/**
 * 관리자 사용자 목록에 적용된 필터를 View 조회 조건으로 변환합니다.
 *
 * @param userQuery 조건을 적용할 admin_user_list View 조회 객체
 * @param filter 현재 적용할 관리자 필터
 * @returns 필터 조건이 반영된 사용자 목록 조회 객체
 */
function applyUserFilter(
  userQuery: AdminUserListQueryBuilder,
  filter: AdminAppliedFilter<UserFilterField>,
) {
  switch (filter.field) {
    case "role":
      if (filter.type === "select") {
        return userQuery.eq("role", filter.value);
      }

      return userQuery;

    case "signupMethod":
      if (filter.type === "select") {
        return userQuery.eq("signup_method", filter.value);
      }

      return userQuery;

    case "agreementStatus":
      if (filter.type === "multi-select") {
        return userQuery.in("agreement_status", filter.value);
      }

      return userQuery;

    case "createdAt": {
      if (filter.type !== "date-range") {
        return userQuery;
      }

      const { from, to } = filter.value;

      if (from) {
        userQuery = userQuery.gte("created_at", startOfDayIsoString(from));
      }

      if (to) {
        userQuery = userQuery.lt("created_at", nextDayIsoString(to));
      }

      return userQuery;
    }

    default:
      return userQuery;
  }
}

/**
 * 관리자 사용자 목록 조회 객체에 현재 적용된 모든 필터를 반영합니다.
 *
 * 값이 설정되지 않은 필터는 조회 조건에서 제외합니다.
 *
 * @param userQuery 조건을 적용할 admin_user_list View 조회 객체
 * @param filters 목록 화면의 현재 필터 상태
 * @returns 모든 적용 필터가 반영된 사용자 목록 조회 객체
 */
export function applyUserFilters(
  userQuery: AdminUserListQueryBuilder,
  filters: AdminUserListQuery["filters"],
) {
  let filteredQuery = userQuery;

  for (const filter of Object.values(filters)) {
    if (filter === undefined) {
      continue;
    }

    filteredQuery = applyUserFilter(filteredQuery, filter);
  }

  return filteredQuery;
}
