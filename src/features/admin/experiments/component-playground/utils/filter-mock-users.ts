import type { AdminAppliedFilter } from "@/features/admin/types/filter";
import type { AdminSearchValue } from "@/features/admin/types/search";

import type {
  ComponentPlaygroundFilterField,
  ComponentPlaygroundFilters,
} from "../types/filter";
import type { MockUser } from "../types/mock-user";
import type { ComponentPlaygroundSearchField } from "../types/search";

interface FilterMockUsersParams {
  /** 검색과 필터를 적용할 원본 사용자 목록 */
  users: readonly MockUser[];

  /** 현재 적용할 검색 필드와 검색어 */
  search: AdminSearchValue<ComponentPlaygroundSearchField>;

  /** 사용자가 적용 버튼으로 확정한 필터 목록 */
  filters: ComponentPlaygroundFilters;
}

/**
 * 검색어가 지정된 필드의 사용자 값에 포함되는지 확인합니다.
 *
 * 앞뒤 공백과 영문 대소문자를 무시하여 검색합니다.
 *
 * @param user 검색할 사용자
 * @param search 현재 검색 조건
 * @returns 사용자가 검색 조건과 일치하면 true
 */
function matchesSearch(
  user: MockUser,
  search: AdminSearchValue<ComponentPlaygroundSearchField>,
): boolean {
  const normalizedQuery = search.query.trim().toLocaleLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return user[search.field].toLocaleLowerCase().includes(normalizedQuery);
}

/**
 * 사용자가 하나의 적용 필터 조건과 일치하는지 확인합니다.
 *
 * Multi-select 필터에서 선택한 여러 값은 OR 조건으로 처리합니다.
 * 역할 필터는 사용자의 역할 중 하나라도 선택값에 포함되면 일치합니다.
 *
 * @param user 확인할 사용자
 * @param filter 적용된 필터
 * @returns 사용자가 필터 조건과 일치하면 true
 */
function matchesFilter(
  user: MockUser,
  filter: AdminAppliedFilter<ComponentPlaygroundFilterField>,
): boolean {
  switch (filter.field) {
    case "status": {
      if (filter.type !== "multi-select") {
        return true;
      }

      return filter.value.includes(user.status);
    }

    case "roles": {
      if (filter.type !== "multi-select") {
        return true;
      }

      return user.roles.some((role) => filter.value.includes(role));
    }

    case "grade": {
      if (filter.type !== "select") {
        return true;
      }

      return user.grade === filter.value;
    }

    case "score": {
      if (filter.type !== "number-range") {
        return true;
      }

      const { min, max } = filter.value;

      if (min !== null && user.score < min) {
        return false;
      }

      if (max !== null && user.score > max) {
        return false;
      }

      return true;
    }

    case "createdAt": {
      if (filter.type !== "date-range") {
        return true;
      }

      const { from, to } = filter.value;
      const createdAtTime = user.createdAt.getTime();

      if (from !== null) {
        const startDate = new Date(from);

        startDate.setHours(0, 0, 0, 0);

        if (createdAtTime < startDate.getTime()) {
          return false;
        }
      }

      if (to !== null) {
        const nextDate = new Date(to);

        nextDate.setHours(0, 0, 0, 0);
        nextDate.setDate(nextDate.getDate() + 1);

        if (createdAtTime >= nextDate.getTime()) {
          return false;
        }
      }

      return true;
    }
  }
}

/**
 * Mock 사용자 목록에 현재 검색 조건과 적용 필터를 반영합니다.
 *
 * 검색과 서로 다른 필터는 AND 조건으로 결합합니다.
 * 하나의 Multi-select 필터 안에서 선택한 값들은 OR 조건으로 처리합니다.
 *
 * @param params 원본 사용자 목록과 검색·필터 조건
 * @returns 검색과 필터 조건을 모두 만족하는 사용자 목록
 */
export function filterMockUsers({
  users,
  search,
  filters,
}: FilterMockUsersParams): MockUser[] {
  const appliedFilters = Object.values(filters).filter(
    (filter): filter is AdminAppliedFilter<ComponentPlaygroundFilterField> =>
      filter !== undefined,
  );

  return users.filter((user) => {
    if (!matchesSearch(user, search)) {
      return false;
    }

    return appliedFilters.every((filter) => matchesFilter(user, filter));
  });
}
