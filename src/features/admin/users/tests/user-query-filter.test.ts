import { describe, expect, it, vi } from "vitest";

import type { AdminUserListQuery } from "../types/user-list";
import { AdminUserListQueryBuilder } from "../utils/user-query";
import { applyUserFilters } from "../utils/user-query-filter";

/**
 * Supabase QueryBuilder의 필터 메서드 호출을 검증하기 위한 테스트 객체입니다.
 */
function createQueryBuilderMock() {
  const queryBuilder = {
    eq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
  };

  queryBuilder.eq.mockReturnValue(queryBuilder);
  queryBuilder.in.mockReturnValue(queryBuilder);
  queryBuilder.gte.mockReturnValue(queryBuilder);
  queryBuilder.lt.mockReturnValue(queryBuilder);

  return queryBuilder;
}

/**
 * 테스트용 QueryBuilder를 실제 사용자 목록 QueryBuilder 타입으로 변환합니다.
 */
function asUserQueryBuilder(
  queryBuilder: ReturnType<typeof createQueryBuilderMock>,
): AdminUserListQueryBuilder {
  return queryBuilder as unknown as AdminUserListQueryBuilder;
}

describe("applyUserFilters", () => {
  it("권한 select 필터를 role 동등 조건으로 적용합니다.", () => {
    const queryBuilder = createQueryBuilderMock();
    const filters: AdminUserListQuery["filters"] = {
      role: {
        field: "role",
        type: "select",
        value: "ADMIN",
      },
    };

    const result = applyUserFilters(asUserQueryBuilder(queryBuilder), filters);

    expect(queryBuilder.eq).toHaveBeenCalledWith("role", "ADMIN");
    expect(result).toBe(queryBuilder);
  });

  it("가입 방법 select 필터를 signup_method 동등 조건으로 적용합니다.", () => {
    const queryBuilder = createQueryBuilderMock();
    const filters: AdminUserListQuery["filters"] = {
      signupMethod: {
        field: "signupMethod",
        type: "select",
        value: "OAUTH",
      },
    };

    applyUserFilters(asUserQueryBuilder(queryBuilder), filters);

    expect(queryBuilder.eq).toHaveBeenCalledWith("signup_method", "OAUTH");
  });

  it("약관 동의 multi-select 필터를 agreement_status 포함 조건으로 적용합니다.", () => {
    const queryBuilder = createQueryBuilderMock();
    const filters: AdminUserListQuery["filters"] = {
      agreementStatus: {
        field: "agreementStatus",
        type: "multi-select",
        value: ["COMPLETED", "PARTIAL"],
      },
    };

    applyUserFilters(asUserQueryBuilder(queryBuilder), filters);

    expect(queryBuilder.in).toHaveBeenCalledWith("agreement_status", [
      "COMPLETED",
      "PARTIAL",
    ]);
  });

  it("가입일 시작일을 created_at 이상 조건으로 적용합니다.", () => {
    const queryBuilder = createQueryBuilderMock();
    const filters: AdminUserListQuery["filters"] = {
      createdAt: {
        field: "createdAt",
        type: "date-range",
        value: {
          from: new Date(2026, 6, 1),
          to: null,
        },
      },
    };

    applyUserFilters(asUserQueryBuilder(queryBuilder), filters);

    expect(queryBuilder.gte).toHaveBeenCalledWith(
      "created_at",
      new Date(2026, 6, 1, 0, 0, 0, 0).toISOString(),
    );
    expect(queryBuilder.lt).not.toHaveBeenCalled();
  });

  it("가입일 종료일 전체를 포함하도록 다음 날 미만 조건을 적용합니다.", () => {
    const queryBuilder = createQueryBuilderMock();
    const filters: AdminUserListQuery["filters"] = {
      createdAt: {
        field: "createdAt",
        type: "date-range",
        value: {
          from: null,
          to: new Date(2026, 6, 31),
        },
      },
    };

    applyUserFilters(asUserQueryBuilder(queryBuilder), filters);

    expect(queryBuilder.lt).toHaveBeenCalledWith(
      "created_at",
      new Date(2026, 7, 1, 0, 0, 0, 0).toISOString(),
    );
    expect(queryBuilder.gte).not.toHaveBeenCalled();
  });

  it("가입일의 시작일과 종료일을 함께 적용합니다.", () => {
    const queryBuilder = createQueryBuilderMock();
    const filters: AdminUserListQuery["filters"] = {
      createdAt: {
        field: "createdAt",
        type: "date-range",
        value: {
          from: new Date(2026, 6, 1),
          to: new Date(2026, 6, 31),
        },
      },
    };

    applyUserFilters(asUserQueryBuilder(queryBuilder), filters);

    expect(queryBuilder.gte).toHaveBeenCalledWith(
      "created_at",
      new Date(2026, 6, 1, 0, 0, 0, 0).toISOString(),
    );
    expect(queryBuilder.lt).toHaveBeenCalledWith(
      "created_at",
      new Date(2026, 7, 1, 0, 0, 0, 0).toISOString(),
    );
  });

  it("여러 필터를 하나의 조회 객체에 순서대로 적용합니다.", () => {
    const queryBuilder = createQueryBuilderMock();
    const filters: AdminUserListQuery["filters"] = {
      role: {
        field: "role",
        type: "select",
        value: "USER",
      },
      signupMethod: {
        field: "signupMethod",
        type: "select",
        value: "EMAIL",
      },
      agreementStatus: {
        field: "agreementStatus",
        type: "multi-select",
        value: ["NOT_AGREED"],
      },
    };

    const result = applyUserFilters(asUserQueryBuilder(queryBuilder), filters);

    expect(queryBuilder.eq).toHaveBeenNthCalledWith(1, "role", "USER");
    expect(queryBuilder.eq).toHaveBeenNthCalledWith(
      2,
      "signup_method",
      "EMAIL",
    );
    expect(queryBuilder.in).toHaveBeenCalledWith("agreement_status", [
      "NOT_AGREED",
    ]);
    expect(result).toBe(queryBuilder);
  });

  it("설정되지 않은 필터는 조회 조건에 적용하지 않습니다.", () => {
    const queryBuilder = createQueryBuilderMock();
    const filters: AdminUserListQuery["filters"] = {};

    const result = applyUserFilters(asUserQueryBuilder(queryBuilder), filters);

    expect(queryBuilder.eq).not.toHaveBeenCalled();
    expect(queryBuilder.in).not.toHaveBeenCalled();
    expect(queryBuilder.gte).not.toHaveBeenCalled();
    expect(queryBuilder.lt).not.toHaveBeenCalled();
    expect(result).toBe(queryBuilder);
  });
});
