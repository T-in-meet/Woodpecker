import { useQuery } from "@tanstack/react-query";

import { getMockUsers } from "../../actions/get-mock-users";
import type { MockUserListQuery } from "../../types/mock-user-list";

export const MOCK_USERS_QUERY_KEY = {
  all: ["mock-users"] as const,

  list: (query: MockUserListQuery) =>
    [...MOCK_USERS_QUERY_KEY.all, "list", query] as const,
};

/**
 * 검색, 필터 및 페이지 조건에 해당하는 Mock 사용자 목록을 조회합니다.
 */
export function useMockUsers(query: MockUserListQuery) {
  return useQuery({
    queryKey: MOCK_USERS_QUERY_KEY.list(query),
    queryFn: () => getMockUsers(query),
    placeholderData: (previousData) => previousData,
  });
}
