import { useQuery } from "@tanstack/react-query";

import { ADMIN_USERS_QUERY_KEY } from "../constants/query-keys";
import { getAdminUsers } from "../queries";
import type { AdminUserListQuery } from "../types/user-list";

/**
 * 관리자 사용자 목록을 조회하는 Query 훅입니다.
 *
 * 검색, 필터, 정렬, 페이지네이션 조건 전체를 Query Key에 포함하여
 * 서로 다른 목록 조건이 각각 독립된 캐시를 사용하도록 합니다.
 *
 * @param query 관리자 사용자 목록 조회 조건
 * @returns 관리자 사용자 목록 Query 결과
 */
export function useUsers(query: AdminUserListQuery) {
  return useQuery({
    queryKey: ADMIN_USERS_QUERY_KEY.list(query),
    queryFn: () => getAdminUsers(query),
  });
}
