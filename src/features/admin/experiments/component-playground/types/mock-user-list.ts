import type { AdminSearchValue } from "@/features/admin/types/search";
import type { AdminSort } from "@/features/admin/types/sort";

import type { ComponentPlaygroundFilters } from "./filter";
import type { MockUser } from "./mock-user";
import type { ComponentPlaygroundSearchField } from "./search";
import type { ComponentPlaygroundSortField } from "./sort";

/**
 * Mock 사용자 목록 조회에 사용하는 조건입니다.
 */
export interface MockUserListQuery {
  /** 조회할 페이지 번호 */
  page: number;

  /** 한 페이지에 표시할 사용자 수 */
  pageSize: number;

  /** 목록에 적용된 검색 조건 */
  search: AdminSearchValue<ComponentPlaygroundSearchField>;

  /** 목록에 적용된 필터 조건 */
  filters: ComponentPlaygroundFilters;

  /** 목록에 적용된 정렬 조건 */
  sort: AdminSort<ComponentPlaygroundSortField>;
}

/**
 * Mock 사용자 목록 조회 결과입니다.
 */
export interface MockUserListResult {
  /** 현재 페이지에 표시할 사용자 목록 */
  items: MockUser[];

  /** 사용자 목록의 페이지네이션 정보 */
  pagination: {
    /** 현재 페이지 번호 */
    page: number;

    /** 한 페이지에 표시하는 사용자 수 */
    pageSize: number;

    /** 전체 사용자 수 */
    total: number;

    /** 전체 페이지 수 */
    totalPages: number;
  };
}
