"use server";

import { MOCK_USERS } from "../constants/mock-users";
import type {
  MockUserListQuery,
  MockUserListResult,
} from "../types/mock-user-list";
import { filterMockUsers } from "../utils/filter-mock-users";
import { sortMockUsers } from "../utils/sort-mock-users";

export async function getMockUsers({
  page,
  pageSize,
  search,
  filters,
  sort,
}: MockUserListQuery): Promise<MockUserListResult> {
  let users = filterMockUsers({
    users: MOCK_USERS,
    search,
    filters,
  });

  users = sortMockUsers(users, sort);

  const total = users.length;
  const startIndex = (page - 1) * pageSize;
  const items = users.slice(startIndex, startIndex + pageSize);

  return {
    items,

    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
