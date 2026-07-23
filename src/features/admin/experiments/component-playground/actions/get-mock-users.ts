"use server";

import type { AdminAppliedFilter } from "@/features/admin/types/filter";

import { MOCK_USERS } from "../constants/mock-users";
import { ComponentPlaygroundFilterField } from "../types/filter";
import type {
  MockUserListQuery,
  MockUserListResult,
} from "../types/mock-user-list";

export async function getMockUsers({
  page,
  pageSize,
  search,
  filters,
}: MockUserListQuery): Promise<MockUserListResult> {
  let users = [...MOCK_USERS];

  const normalizedQuery = search.query.trim().toLocaleLowerCase();

  if (normalizedQuery.length > 0) {
    users = users.filter((user) =>
      user[search.field].toLocaleLowerCase().includes(normalizedQuery),
    );
  }

  const appliedFilters = Object.values(filters).filter(
    (filter): filter is AdminAppliedFilter<ComponentPlaygroundFilterField> =>
      filter !== undefined,
  );

  users = users.filter((user) =>
    appliedFilters.every((filter) => {
      switch (filter.field) {
        case "status":
          return (
            filter.type === "multi-select" && filter.value.includes(user.status)
          );

        case "roles":
          return (
            filter.type === "multi-select" &&
            user.roles.some((role) => filter.value.includes(role))
          );

        case "grade":
          return filter.type === "select" && user.grade === filter.value;

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
          const createdAt = user.createdAt.getTime();

          if (from !== null) {
            const fromDate = new Date(from);

            fromDate.setHours(0, 0, 0, 0);

            if (createdAt < fromDate.getTime()) {
              return false;
            }
          }

          if (to !== null) {
            const toDate = new Date(to);

            toDate.setHours(0, 0, 0, 0);
            toDate.setDate(toDate.getDate() + 1);

            if (createdAt >= toDate.getTime()) {
              return false;
            }
          }

          return true;
        }

        default:
          return true;
      }
    }),
  );

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
