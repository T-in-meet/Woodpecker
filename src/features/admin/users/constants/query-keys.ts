import type { AdminUserListQuery } from "../types/user-list";

/**
 * 관리자 사용자 목록 Query Key입니다.
 */
export const ADMIN_USERS_QUERY_KEY = {
  /** 모든 관리자 사용자 목록 Query의 최상위 Key */
  all: ["admin-users"] as const,

  /**
   * 조회 조건별 Query Key를 생성합니다.
   *
   * @param query 검색, 필터, 정렬, 페이지네이션 조건
   * @returns 조회 조건을 포함한 Query Key
   */
  list: (query: AdminUserListQuery) =>
    [...ADMIN_USERS_QUERY_KEY.all, query] as const,
};
