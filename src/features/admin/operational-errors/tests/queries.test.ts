import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyOperationalErrorFilters: vi.fn(),
  applyOperationalErrorSearch: vi.fn(),
  createAdminClient: vi.fn(),
  mapHistoryRow: vi.fn(),
  mapOperationalErrorRow: vi.fn(),
  notFound: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/features/admin/utils/require-admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("../utils/operational-error-filter", () => ({
  applyOperationalErrorFilters: mocks.applyOperationalErrorFilters,
}));

vi.mock("../utils/operational-error-search", () => ({
  applyOperationalErrorSearch: mocks.applyOperationalErrorSearch,
}));

vi.mock("../utils/operational-error-mapper", () => ({
  mapHistoryRow: mocks.mapHistoryRow,
  mapOperationalErrorRow: mocks.mapOperationalErrorRow,
}));

import { getOperationalErrorDetail, getOperationalErrors } from "../queries";
import type { OperationalErrorListQuery } from "../types/operational-error-list";
import type {
  OperationalErrorRow,
  OperationalErrorStatusHistoryRow,
} from "../types/operational-error-query";

const listQuery: OperationalErrorListQuery = {
  filters: {},
  page: 2,
  pageSize: 20,
  search: {
    field: "message",
    query: "",
  },
  sort: {
    direction: "desc",
    field: "lastSeenAt",
  },
};

const operationalErrorRow = {
  actor_user_id: "actor-user-id",
  context: {
    route: "/admin/feedbacks",
  },
  created_at: "2026-07-28T01:00:00.000Z",
  error_code: "UNEXPECTED_ERROR",
  feature: "feedback",
  fingerprint: "fingerprint",
  first_seen_at: "2026-07-27T01:00:00.000Z",
  id: "operational-error-id",
  last_seen_at: "2026-07-28T02:00:00.000Z",
  message: "오류가 발생했습니다.",
  occurrence_count: 3,
  operation: "createFeedback",
  resolution_note: "수정 완료",
  resolved_at: "2026-07-28T03:00:00.000Z",
  resolved_by: "resolver-user-id",
  severity: "ERROR",
  stage: "SERVER_ACTION",
  status: "RESOLVED",
  updated_at: "2026-07-28T03:00:00.000Z",
  user_id: "target-user-id",
} as OperationalErrorRow;

const historyRow = {
  changed_by: "actor-user-id",
  created_at: "2026-07-28T03:00:00.000Z",
  from_status: "OPEN",
  id: "history-id",
  note: "처리 완료",
  to_status: "RESOLVED",
} as OperationalErrorStatusHistoryRow;

describe("getOperationalErrors", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.applyOperationalErrorFilters.mockImplementation((query) => query);
    mocks.applyOperationalErrorSearch.mockImplementation((query) => query);

    mocks.mapOperationalErrorRow.mockImplementation((row) => ({
      id: row.id,
      message: row.message,
    }));
  });

  it("관리자 권한을 확인하고 운영 오류 목록을 반환한다", async () => {
    const rangeMock = vi.fn().mockResolvedValue({
      count: 45,
      data: [operationalErrorRow],
      error: null,
    });

    const orderMock = vi.fn().mockReturnValue({
      range: rangeMock,
    });

    const baseQuery = {
      order: orderMock,
    };

    const selectMock = vi.fn().mockReturnValue(baseQuery);
    const fromMock = vi.fn().mockReturnValue({
      select: selectMock,
    });

    mocks.createAdminClient.mockReturnValue({
      from: fromMock,
    });

    const result = await getOperationalErrors(listQuery);

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(fromMock).toHaveBeenCalledWith("operational_errors");
    expect(mocks.applyOperationalErrorFilters).toHaveBeenCalledWith(
      baseQuery,
      listQuery.filters,
    );
    expect(mocks.applyOperationalErrorSearch).toHaveBeenCalledWith(
      baseQuery,
      listQuery.search,
    );

    expect(orderMock).toHaveBeenCalledWith(expect.any(String), {
      ascending: false,
    });

    expect(rangeMock).toHaveBeenCalledWith(20, 39);

    expect(result).toEqual({
      items: [
        {
          id: "operational-error-id",
          message: "오류가 발생했습니다.",
        },
      ],
      pagination: {
        page: 2,
        pageSize: 20,
        total: 45,
        totalPages: 3,
      },
    });
  });

  it("페이지가 1보다 작으면 1로 보정한다", async () => {
    const rangeMock = vi.fn().mockResolvedValue({
      count: 0,
      data: [],
      error: null,
    });

    const orderMock = vi.fn().mockReturnValue({
      range: rangeMock,
    });

    const baseQuery = {
      order: orderMock,
    };

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(baseQuery),
      }),
    });

    const result = await getOperationalErrors({
      ...listQuery,
      page: 0,
    });

    expect(rangeMock).toHaveBeenCalledWith(0, 19);
    expect(result.pagination.page).toBe(1);
  });

  it("count가 null이면 조회된 행 개수를 사용한다", async () => {
    const rangeMock = vi.fn().mockResolvedValue({
      count: null,
      data: [operationalErrorRow],
      error: null,
    });

    const baseQuery = {
      order: vi.fn().mockReturnValue({
        range: rangeMock,
      }),
    };

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(baseQuery),
      }),
    });

    const result = await getOperationalErrors({
      ...listQuery,
      page: 1,
    });

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("운영 오류 목록 조회에 실패하면 오류를 던진다", async () => {
    const baseQuery = {
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          count: null,
          data: null,
          error: {
            message: "database error",
          },
        }),
      }),
    };

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(baseQuery),
      }),
    });

    await expect(getOperationalErrors(listQuery)).rejects.toThrow(
      "Failed to load operational errors: database error",
    );
  });
});

describe("getOperationalErrorDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mapOperationalErrorRow.mockReturnValue({
      context: operationalErrorRow.context,
      createdAt: operationalErrorRow.created_at,
      errorCode: operationalErrorRow.error_code,
      feature: operationalErrorRow.feature,
      fingerprint: operationalErrorRow.fingerprint,
      id: operationalErrorRow.id,
      lastSeenAt: operationalErrorRow.last_seen_at,
      message: operationalErrorRow.message,
      occurrenceCount: operationalErrorRow.occurrence_count,
      operation: operationalErrorRow.operation,
      severity: operationalErrorRow.severity,
      stage: operationalErrorRow.stage,
      status: operationalErrorRow.status,
      userId: operationalErrorRow.user_id,
    });

    mocks.mapHistoryRow.mockReturnValue({
      changedBy: historyRow.changed_by,
      changedByLabel: "행위자",
      createdAt: historyRow.created_at,
      fromStatus: historyRow.from_status,
      id: historyRow.id,
      note: historyRow.note,
      toStatus: historyRow.to_status,
    });
  });

  it("운영 오류 상세와 사용자 표시 이름 및 처리 이력을 반환한다", async () => {
    const operationalErrorMaybeSingleMock = vi.fn().mockResolvedValue({
      data: operationalErrorRow,
      error: null,
    });

    const operationalErrorEqMock = vi.fn().mockReturnValue({
      maybeSingle: operationalErrorMaybeSingleMock,
    });

    const historyOrderMock = vi.fn().mockResolvedValue({
      data: [historyRow],
      error: null,
    });

    const historyEqMock = vi.fn().mockReturnValue({
      order: historyOrderMock,
    });

    const profileInMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "target-user-id",
          nickname: "대상 사용자",
        },
        {
          id: "actor-user-id",
          nickname: "행위자",
        },
        {
          id: "resolver-user-id",
          nickname: "처리 관리자",
        },
      ],
      error: null,
    });

    const fromMock = vi.fn((table: string) => {
      if (table === "operational_errors") {
        return {
          select: vi.fn().mockReturnValue({
            eq: operationalErrorEqMock,
          }),
        };
      }

      if (table === "operational_error_status_history") {
        return {
          select: vi.fn().mockReturnValue({
            eq: historyEqMock,
          }),
        };
      }

      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            in: profileInMock,
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    mocks.createAdminClient.mockReturnValue({
      from: fromMock,
    });

    const result = await getOperationalErrorDetail("operational-error-id");

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();

    expect(operationalErrorEqMock).toHaveBeenCalledWith(
      "id",
      "operational-error-id",
    );

    expect(historyEqMock).toHaveBeenCalledWith(
      "operational_error_id",
      "operational-error-id",
    );

    expect(historyOrderMock).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });

    expect(profileInMock).toHaveBeenCalledWith(
      "id",
      expect.arrayContaining([
        "target-user-id",
        "actor-user-id",
        "resolver-user-id",
      ]),
    );

    const requestedProfileIds = profileInMock.mock.calls[0]?.[1];

    expect(requestedProfileIds).toHaveLength(3);

    expect(result).toMatchObject({
      actorUserId: "actor-user-id",
      actorUserLabel: "행위자",
      firstSeenAt: operationalErrorRow.first_seen_at,
      resolutionNote: "수정 완료",
      resolvedAt: operationalErrorRow.resolved_at,
      resolvedBy: "resolver-user-id",
      resolvedByLabel: "처리 관리자",
      updatedAt: operationalErrorRow.updated_at,
      userLabel: "대상 사용자",
    });

    expect(result.history).toEqual([
      {
        changedBy: "actor-user-id",
        changedByLabel: "행위자",
        createdAt: historyRow.created_at,
        fromStatus: "OPEN",
        id: "history-id",
        note: "처리 완료",
        toStatus: "RESOLVED",
      },
    ]);

    expect(mocks.mapOperationalErrorRow).toHaveBeenCalledWith(
      operationalErrorRow,
    );

    expect(mocks.mapHistoryRow).toHaveBeenCalledWith(
      historyRow,
      expect.any(Map),
    );
  });

  it("프로필이 없으면 사용자 ID를 표시 이름으로 사용한다", async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === "operational_errors") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: operationalErrorRow,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "operational_error_status_history") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    mocks.createAdminClient.mockReturnValue({
      from: fromMock,
    });

    const result = await getOperationalErrorDetail("operational-error-id");

    expect(result.userLabel).toBe("target-user-id");
    expect(result.actorUserLabel).toBe("actor-user-id");
    expect(result.resolvedByLabel).toBe("resolver-user-id");
  });

  it("운영 오류가 없으면 notFound를 호출한다", async () => {
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
    });

    await expect(getOperationalErrorDetail("missing-id")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("처리 이력 조회에 실패하면 오류를 던진다", async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === "operational_errors") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: operationalErrorRow,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "operational_error_status_history") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: {
                  message: "history error",
                },
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    mocks.createAdminClient.mockReturnValue({
      from: fromMock,
    });

    await expect(
      getOperationalErrorDetail("operational-error-id"),
    ).rejects.toThrow(
      "Failed to load operational error history: history error",
    );
  });

  it("프로필 조회에 실패하면 오류를 던진다", async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === "operational_errors") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: operationalErrorRow,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "operational_error_status_history") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: null,
              error: {
                message: "profiles error",
              },
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    mocks.createAdminClient.mockReturnValue({
      from: fromMock,
    });

    await expect(
      getOperationalErrorDetail("operational-error-id"),
    ).rejects.toThrow(
      "Failed to load operational error profiles: profiles error",
    );
  });

  it("표시할 사용자 ID가 없으면 프로필을 조회하지 않는다", async () => {
    const rowWithoutProfiles = {
      ...operationalErrorRow,
      actor_user_id: null,
      resolved_by: null,
      user_id: null,
    };

    const fromMock = vi.fn((table: string) => {
      if (table === "operational_errors") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: rowWithoutProfiles,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "operational_error_status_history") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    mocks.createAdminClient.mockReturnValue({
      from: fromMock,
    });

    const result = await getOperationalErrorDetail("operational-error-id");

    expect(fromMock).not.toHaveBeenCalledWith("profiles");
    expect(result.userLabel).toBeNull();
    expect(result.actorUserLabel).toBeNull();
    expect(result.resolvedByLabel).toBeNull();
  });
});
