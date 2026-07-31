import { describe, expect, it, vi } from "vitest";

import type { AdminUserListQuery } from "../types/user-list";
import { AdminUserListQueryBuilder } from "../utils/user-query";
import { applyUserSort } from "../utils/user-sort";

/**
 * Supabase QueryBuilder의 정렬 호출을 검증하기 위한 테스트 객체입니다.
 */
function createQueryBuilderMock() {
  const queryBuilder = {
    order: vi.fn(),
  };

  queryBuilder.order.mockReturnValue(queryBuilder);

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

describe("applyUserSort", () => {
  it.each<[AdminUserListQuery["sort"]["field"], string]>([
    ["nickname", "nickname"],
    ["email", "canonical_email"],
    ["role", "role"],
    ["createdAt", "created_at"],
  ])("%s 정렬 필드를 %s View 컬럼에 대응시킵니다.", (field, column) => {
    const queryBuilder = createQueryBuilderMock();
    const sort: AdminUserListQuery["sort"] = {
      field,
      direction: "asc",
    };

    const result = applyUserSort(asUserQueryBuilder(queryBuilder), sort);

    expect(queryBuilder.order).toHaveBeenCalledWith(column, {
      ascending: true,
    });
    expect(result).toBe(queryBuilder);
  });

  it("오름차순 정렬을 ascending true로 적용합니다.", () => {
    const queryBuilder = createQueryBuilderMock();
    const sort: AdminUserListQuery["sort"] = {
      field: "nickname",
      direction: "asc",
    };

    applyUserSort(asUserQueryBuilder(queryBuilder), sort);

    expect(queryBuilder.order).toHaveBeenCalledWith("nickname", {
      ascending: true,
    });
  });

  it("내림차순 정렬을 ascending false로 적용합니다.", () => {
    const queryBuilder = createQueryBuilderMock();
    const sort: AdminUserListQuery["sort"] = {
      field: "createdAt",
      direction: "desc",
    };

    applyUserSort(asUserQueryBuilder(queryBuilder), sort);

    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });
});
