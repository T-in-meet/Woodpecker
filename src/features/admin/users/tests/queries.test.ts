import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/features/admin/utils/require-admin";
import {
  OPERATIONAL_ERROR_CODES,
  OPERATIONAL_ERROR_FEATURES,
  OPERATIONAL_ERROR_OPERATIONS,
  OPERATIONAL_ERROR_SEVERITY,
  OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";
import { reportOperationalError } from "@/features/operational-errors/report";
import { createAdminClient } from "@/lib/supabase/admin";

import { getAdminUsers } from "../queries";
import type {
  AdminUserListQuery,
  AdminUserListResult,
} from "../types/user-list";
import {
  createAdminUserListQuery,
  escapePostgrestLikePattern,
} from "../utils/user-query";
import { applyUserFilters } from "../utils/user-query-filter";
import type { AdminUserListRow } from "../utils/user-query-mapper";
import { mapUserRows } from "../utils/user-query-mapper";
import { applyUserSort } from "../utils/user-sort";

vi.mock("@/features/operational-errors/report", () => ({
  reportOperationalError: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/admin/utils/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../utils/user-query", () => ({
  createAdminUserListQuery: vi.fn(),
  escapePostgrestLikePattern: vi.fn(),
}));

vi.mock("../utils/user-query-filter", () => ({
  applyUserFilters: vi.fn(),
}));

vi.mock("../utils/user-query-mapper", () => ({
  mapUserRows: vi.fn(),
}));

vi.mock("../utils/user-sort", () => ({
  applyUserSort: vi.fn(),
}));

const requireAdminMock = vi.mocked(requireAdmin);
const createAdminClientMock = vi.mocked(createAdminClient);
const reportOperationalErrorMock = vi.mocked(reportOperationalError);
const createAdminUserListQueryMock = vi.mocked(createAdminUserListQuery);
const escapePostgrestLikePatternMock = vi.mocked(escapePostgrestLikePattern);
const applyUserFiltersMock = vi.mocked(applyUserFilters);
const mapUserRowsMock = vi.mocked(mapUserRows);
const applyUserSortMock = vi.mocked(applyUserSort);

/**
 * 테스트에서 공통으로 사용하는 사용자 목록 조회 조건입니다.
 */
const DEFAULT_QUERY: AdminUserListQuery = {
  page: 1,
  pageSize: 10,
  search: {
    field: "nickname",
    query: "",
  },
  filters: {},
  sort: {
    field: "createdAt",
    direction: "desc",
  },
};

/**
 * Supabase 사용자 목록 조회 QueryBuilder의 테스트 대역을 생성합니다.
 */
function createUserQueryBuilderMock() {
  const queryBuilder = {
    ilike: vi.fn(),
    range: vi.fn(),
  };

  queryBuilder.ilike.mockReturnValue(queryBuilder);

  return queryBuilder;
}

describe("getAdminUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAdminMock.mockResolvedValue("admin-user-id");
    createAdminClientMock.mockReturnValue({} as never);
    escapePostgrestLikePatternMock.mockImplementation((value) => value);
  });

  it("관리자 권한을 확인한 후 사용자 목록 View 조회를 생성합니다.", async () => {
    const baseQuery = createUserQueryBuilderMock();
    const filteredQuery = createUserQueryBuilderMock();
    const sortedQuery = createUserQueryBuilderMock();

    createAdminUserListQueryMock.mockReturnValue(baseQuery as never);
    applyUserFiltersMock.mockReturnValue(filteredQuery as never);
    applyUserSortMock.mockReturnValue(sortedQuery as never);
    sortedQuery.range.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });
    mapUserRowsMock.mockReturnValue([]);

    await getAdminUsers(DEFAULT_QUERY);

    expect(requireAdminMock).toHaveBeenCalledOnce();
    expect(createAdminClientMock).toHaveBeenCalledOnce();
    expect(createAdminUserListQueryMock).toHaveBeenCalledOnce();

    const requireAdminCallOrder = requireAdminMock.mock.invocationCallOrder[0];
    const createAdminClientCallOrder =
      createAdminClientMock.mock.invocationCallOrder[0];

    expect(requireAdminCallOrder!).toBeLessThan(createAdminClientCallOrder!);
    expect(reportOperationalErrorMock).not.toHaveBeenCalled();
  });

  it("닉네임 검색어의 공백을 제거하고 nickname 조건을 적용합니다.", async () => {
    const baseQuery = createUserQueryBuilderMock();
    const filteredQuery = createUserQueryBuilderMock();
    const sortedQuery = createUserQueryBuilderMock();

    createAdminUserListQueryMock.mockReturnValue(baseQuery as never);
    applyUserFiltersMock.mockReturnValue(filteredQuery as never);
    applyUserSortMock.mockReturnValue(sortedQuery as never);
    escapePostgrestLikePatternMock.mockReturnValue("woodpecker");
    sortedQuery.range.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });
    mapUserRowsMock.mockReturnValue([]);

    await getAdminUsers({
      ...DEFAULT_QUERY,
      search: {
        field: "nickname",
        query: "  woodpecker  ",
      },
    });

    expect(escapePostgrestLikePatternMock).toHaveBeenCalledWith("woodpecker");
    expect(baseQuery.ilike).toHaveBeenCalledWith("nickname", "%woodpecker%");
  });

  it("이메일 검색 시 canonical_email 조건을 적용합니다.", async () => {
    const baseQuery = createUserQueryBuilderMock();
    const filteredQuery = createUserQueryBuilderMock();
    const sortedQuery = createUserQueryBuilderMock();

    createAdminUserListQueryMock.mockReturnValue(baseQuery as never);
    applyUserFiltersMock.mockReturnValue(filteredQuery as never);
    applyUserSortMock.mockReturnValue(sortedQuery as never);
    escapePostgrestLikePatternMock.mockReturnValue("user@example.com");
    sortedQuery.range.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });
    mapUserRowsMock.mockReturnValue([]);

    await getAdminUsers({
      ...DEFAULT_QUERY,
      search: {
        field: "email",
        query: "user@example.com",
      },
    });

    expect(baseQuery.ilike).toHaveBeenCalledWith(
      "canonical_email",
      "%user@example.com%",
    );
  });

  it("검색어가 공백뿐이면 검색 조건을 적용하지 않습니다.", async () => {
    const baseQuery = createUserQueryBuilderMock();
    const filteredQuery = createUserQueryBuilderMock();
    const sortedQuery = createUserQueryBuilderMock();

    createAdminUserListQueryMock.mockReturnValue(baseQuery as never);
    applyUserFiltersMock.mockReturnValue(filteredQuery as never);
    applyUserSortMock.mockReturnValue(sortedQuery as never);
    sortedQuery.range.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });
    mapUserRowsMock.mockReturnValue([]);

    await getAdminUsers({
      ...DEFAULT_QUERY,
      search: {
        field: "nickname",
        query: "   ",
      },
    });

    expect(escapePostgrestLikePatternMock).not.toHaveBeenCalled();
    expect(baseQuery.ilike).not.toHaveBeenCalled();
  });

  it("필터와 정렬 조건을 순서대로 조회 QueryBuilder에 적용합니다.", async () => {
    const baseQuery = createUserQueryBuilderMock();
    const filteredQuery = createUserQueryBuilderMock();
    const sortedQuery = createUserQueryBuilderMock();

    const filters: AdminUserListQuery["filters"] = {
      role: {
        field: "role",
        type: "select",
        value: "ADMIN",
      },
    };

    const sort: AdminUserListQuery["sort"] = {
      field: "email",
      direction: "asc",
    };

    createAdminUserListQueryMock.mockReturnValue(baseQuery as never);
    applyUserFiltersMock.mockReturnValue(filteredQuery as never);
    applyUserSortMock.mockReturnValue(sortedQuery as never);
    sortedQuery.range.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });
    mapUserRowsMock.mockReturnValue([]);

    await getAdminUsers({
      ...DEFAULT_QUERY,
      filters,
      sort,
    });

    expect(applyUserFiltersMock).toHaveBeenCalledWith(baseQuery, filters);
    expect(applyUserSortMock).toHaveBeenCalledWith(filteredQuery, sort);
  });

  it("페이지 번호를 1 이상으로 보정하고 조회 범위를 계산합니다.", async () => {
    const baseQuery = createUserQueryBuilderMock();
    const filteredQuery = createUserQueryBuilderMock();
    const sortedQuery = createUserQueryBuilderMock();

    createAdminUserListQueryMock.mockReturnValue(baseQuery as never);
    applyUserFiltersMock.mockReturnValue(filteredQuery as never);
    applyUserSortMock.mockReturnValue(sortedQuery as never);
    sortedQuery.range.mockResolvedValue({
      data: [],
      error: null,
      count: 25,
    });
    mapUserRowsMock.mockReturnValue([]);

    const result = await getAdminUsers({
      ...DEFAULT_QUERY,
      page: 0,
      pageSize: 10,
    });

    expect(sortedQuery.range).toHaveBeenCalledWith(0, 9);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 25,
      totalPages: 3,
    });
  });

  it("현재 페이지에 맞는 Supabase 조회 범위를 적용합니다.", async () => {
    const baseQuery = createUserQueryBuilderMock();
    const filteredQuery = createUserQueryBuilderMock();
    const sortedQuery = createUserQueryBuilderMock();

    createAdminUserListQueryMock.mockReturnValue(baseQuery as never);
    applyUserFiltersMock.mockReturnValue(filteredQuery as never);
    applyUserSortMock.mockReturnValue(sortedQuery as never);
    sortedQuery.range.mockResolvedValue({
      data: [],
      error: null,
      count: 42,
    });
    mapUserRowsMock.mockReturnValue([]);

    const result = await getAdminUsers({
      ...DEFAULT_QUERY,
      page: 3,
      pageSize: 10,
    });

    expect(sortedQuery.range).toHaveBeenCalledWith(20, 29);
    expect(result.pagination).toEqual({
      page: 3,
      pageSize: 10,
      total: 42,
      totalPages: 5,
    });
  });

  it("조회한 View row를 사용자 목록 Item으로 변환합니다.", async () => {
    const baseQuery = createUserQueryBuilderMock();
    const filteredQuery = createUserQueryBuilderMock();
    const sortedQuery = createUserQueryBuilderMock();

    const rows = [
      {
        id: "user-1",
      },
    ] as AdminUserListRow[];

    const items = [
      {
        id: "user-1",
      },
    ] as AdminUserListResult["items"];

    createAdminUserListQueryMock.mockReturnValue(baseQuery as never);
    applyUserFiltersMock.mockReturnValue(filteredQuery as never);
    applyUserSortMock.mockReturnValue(sortedQuery as never);
    sortedQuery.range.mockResolvedValue({
      data: rows,
      error: null,
      count: 1,
    });
    mapUserRowsMock.mockReturnValue(items);

    const result = await getAdminUsers(DEFAULT_QUERY);

    expect(mapUserRowsMock).toHaveBeenCalledWith(rows);
    expect(result.items).toBe(items);
  });

  it("count가 null이면 현재 조회된 row 수를 전체 개수로 사용합니다.", async () => {
    const baseQuery = createUserQueryBuilderMock();
    const filteredQuery = createUserQueryBuilderMock();
    const sortedQuery = createUserQueryBuilderMock();

    const rows = [{ id: "user-1" }, { id: "user-2" }] as AdminUserListRow[];

    createAdminUserListQueryMock.mockReturnValue(baseQuery as never);
    applyUserFiltersMock.mockReturnValue(filteredQuery as never);
    applyUserSortMock.mockReturnValue(sortedQuery as never);
    sortedQuery.range.mockResolvedValue({
      data: rows,
      error: null,
      count: null,
    });
    mapUserRowsMock.mockReturnValue([]);

    const result = await getAdminUsers(DEFAULT_QUERY);

    expect(result.pagination.total).toBe(2);
    expect(result.pagination.totalPages).toBe(1);
  });

  it("data가 null이면 빈 row 목록을 mapper에 전달합니다.", async () => {
    const baseQuery = createUserQueryBuilderMock();
    const filteredQuery = createUserQueryBuilderMock();
    const sortedQuery = createUserQueryBuilderMock();

    createAdminUserListQueryMock.mockReturnValue(baseQuery as never);
    applyUserFiltersMock.mockReturnValue(filteredQuery as never);
    applyUserSortMock.mockReturnValue(sortedQuery as never);
    sortedQuery.range.mockResolvedValue({
      data: null,
      error: null,
      count: 0,
    });
    mapUserRowsMock.mockReturnValue([]);

    const result = await getAdminUsers(DEFAULT_QUERY);

    expect(mapUserRowsMock).toHaveBeenCalledWith([]);
    expect(result.items).toEqual([]);
  });

  it("사용자 목록 조회가 실패하면 운영 오류를 기록하고 원본 오류 메시지를 포함해 예외를 발생시킵니다.", async () => {
    const baseQuery = createUserQueryBuilderMock();
    const filteredQuery = createUserQueryBuilderMock();
    const sortedQuery = createUserQueryBuilderMock();

    const queryError = {
      message: "View query failed",
    };

    const query: AdminUserListQuery = {
      ...DEFAULT_QUERY,
      page: 2,
      pageSize: 20,
      search: {
        field: "email",
        query: "  user@example.com  ",
      },
      filters: {
        role: {
          field: "role",
          type: "select",
          value: "ADMIN",
        },
        signupMethod: {
          field: "signupMethod",
          type: "select",
          value: "SOCIAL",
        },
      },
      sort: {
        field: "email",
        direction: "asc",
      },
    };

    createAdminUserListQueryMock.mockReturnValue(baseQuery as never);
    applyUserFiltersMock.mockReturnValue(filteredQuery as never);
    applyUserSortMock.mockReturnValue(sortedQuery as never);
    escapePostgrestLikePatternMock.mockReturnValue("user@example.com");

    sortedQuery.range.mockResolvedValue({
      data: null,
      count: null,
      error: queryError,
    });

    await expect(getAdminUsers(query)).rejects.toThrow(
      "Failed to load admin users: View query failed",
    );

    expect(reportOperationalErrorMock).toHaveBeenCalledOnce();
    expect(reportOperationalErrorMock).toHaveBeenCalledWith({
      actorUserId: "admin-user-id",
      context: {
        appliedFilterFields: ["role", "signupMethod"],
        page: 2,
        pageSize: 20,
        searchField: "email",
        searchQueryApplied: true,
        sortDirection: "asc",
        sortField: "email",
      },
      error: queryError,
      errorCode: OPERATIONAL_ERROR_CODES.ADMIN_USERS_LOAD_FAILED,
      feature: OPERATIONAL_ERROR_FEATURES.ADMIN_USERS,
      message: "관리자 사용자 목록 조회에 실패했습니다.",
      operation: OPERATIONAL_ERROR_OPERATIONS.GET_ADMIN_USERS,
      severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
      stage: OPERATIONAL_ERROR_STAGES.USER_LIST_QUERY,
    });

    expect(mapUserRowsMock).not.toHaveBeenCalled();
  });
});
