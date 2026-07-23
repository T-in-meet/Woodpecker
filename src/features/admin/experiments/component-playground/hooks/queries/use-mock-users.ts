import { useQuery } from "@tanstack/react-query";

import { getMockUsers } from "../../actions/get-mock-users";
import { GetMockUsersParams } from "../../types/get-mock-users";

export const MOCK_USERS_QUERY_KEY = {
  all: ["mock-users"] as const,

  list: (params: GetMockUsersParams) =>
    [...MOCK_USERS_QUERY_KEY.all, "list", params] as const,
};

export function useMockUsers(params: GetMockUsersParams) {
  return useQuery({
    queryKey: MOCK_USERS_QUERY_KEY.list(params),

    queryFn: () => getMockUsers(params),

    placeholderData: (previousData) => previousData,
  });
}
