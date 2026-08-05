import { describe, expect, it } from "vitest";

import type { ComponentPlaygroundFilters } from "../types/filter";
import type { MockUser } from "../types/mock-user";
import { filterMockUsers } from "./filter-mock-users";

const USERS = [
  {
    id: 1,
    name: "Alice",
    email: "alice@example.com",
    status: "active",
    roles: ["user", "editor"],
    grade: "premium",
    score: 85,
    createdAt: new Date(2025, 0, 2, 10, 30),
  },
  {
    id: 2,
    name: "Bob",
    email: "bob@example.com",
    status: "inactive",
    roles: ["user"],
    grade: "basic",
    score: 40,
    createdAt: new Date(2025, 0, 4, 9, 0),
  },
  {
    id: 3,
    name: "Carol",
    email: "carol@example.com",
    status: "suspended",
    roles: ["user", "admin"],
    grade: "vip",
    score: 95,
    createdAt: new Date(2025, 0, 6, 18, 0),
  },
] satisfies MockUser[];

const EMPTY_FILTERS = {} satisfies ComponentPlaygroundFilters;

describe("filterMockUsers", () => {
  it("검색어의 앞뒤 공백과 대소문자를 무시해 지정 필드를 검색한다", () => {
    const result = filterMockUsers({
      users: USERS,
      search: {
        field: "email",
        query: "  ALICE@EXAMPLE  ",
      },
      filters: EMPTY_FILTERS,
    });

    expect(result.map((user) => user.id)).toEqual([1]);
  });

  it("status, roles, grade 필터를 적용한다", () => {
    const filters = {
      status: {
        field: "status",
        type: "multi-select",
        value: ["active", "suspended"],
      },
      roles: {
        field: "roles",
        type: "multi-select",
        value: ["admin"],
      },
      grade: {
        field: "grade",
        type: "select",
        value: "vip",
      },
    } satisfies ComponentPlaygroundFilters;

    const result = filterMockUsers({
      users: USERS,
      search: {
        field: "name",
        query: "",
      },
      filters,
    });

    expect(result.map((user) => user.id)).toEqual([3]);
  });

  it("score 범위와 createdAt 일 단위 범위를 포함 조건으로 적용한다", () => {
    const filters = {
      score: {
        field: "score",
        type: "number-range",
        value: {
          min: 80,
          max: 95,
        },
      },
      createdAt: {
        field: "createdAt",
        type: "date-range",
        value: {
          from: new Date(2025, 0, 2),
          to: new Date(2025, 0, 6),
        },
      },
    } satisfies ComponentPlaygroundFilters;

    const result = filterMockUsers({
      users: USERS,
      search: {
        field: "name",
        query: "",
      },
      filters,
    });

    expect(result.map((user) => user.id)).toEqual([1, 3]);
  });
});
