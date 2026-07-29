"use server";

import {
  OPERATIONAL_ERROR_CODES,
  OPERATIONAL_ERROR_FEATURES,
  OPERATIONAL_ERROR_OPERATIONS,
  OPERATIONAL_ERROR_SEVERITY,
  OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";
import { reportOperationalError } from "@/features/operational-errors/report";
import { createAdminClient } from "@/lib/supabase/admin";

import { escapePostgrestLikePattern } from "../utils/query";
import { requireAdmin } from "../utils/require-admin";
import type {
  AdminUserListQuery,
  AdminUserListResult,
} from "./types/user-list";
import { createAdminUserListQuery } from "./utils/user-query";
import { applyUserFilters } from "./utils/user-query-filter";
import { type AdminUserListRow, mapUserRows } from "./utils/user-query-mapper";
import { applyUserSort } from "./utils/user-sort";

/**
 * 관리자 사용자 목록 화면의 검색, 필터, 정렬,
 * 페이지네이션 조건에 맞는 사용자를 조회합니다.
 *
 * 관리자 전용 View는 service role을 통해 조회하므로
 * action 시작 시 관리자 권한을 먼저 확인합니다.
 *
 * @param query 목록 toolbar와 pagination에서 전달한 조회 조건
 * @returns 현재 페이지의 사용자 목록과 페이지네이션 메타데이터
 */
export async function getAdminUsers(
  query: AdminUserListQuery,
): Promise<AdminUserListResult> {
  const adminUserId = await requireAdmin();

  const supabase = createAdminClient();
  const page = Math.max(1, query.page);
  const pageSize = query.pageSize;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let userQuery = createAdminUserListQuery(supabase);

  const normalizedSearchQuery = query.search.query.trim();

  if (normalizedSearchQuery.length > 0) {
    const pattern = `%${escapePostgrestLikePattern(normalizedSearchQuery)}%`;

    if (query.search.field === "nickname") {
      userQuery = userQuery.ilike("nickname", pattern);
    }

    if (query.search.field === "email") {
      userQuery = userQuery.ilike("canonical_email", pattern);
    }
  }

  // 공통 toolbar의 판별 유니온 필터를 View 조회 조건으로 변환한다.
  userQuery = applyUserFilters(userQuery, query.filters);

  // 공통 toolbar의 정렬 조건을 View 조회에 적용한다.
  userQuery = applyUserSort(userQuery, query.sort);

  const { data, error, count } = await userQuery.range(from, to);

  if (error) {
    await reportOperationalError({
      actorUserId: adminUserId,
      context: {
        appliedFilterFields: Object.keys(query.filters),
        page,
        pageSize,
        searchField: query.search.field,
        searchQueryApplied: normalizedSearchQuery.length > 0,
        sortDirection: query.sort.direction,
        sortField: query.sort.field,
      },
      error,
      errorCode: OPERATIONAL_ERROR_CODES.ADMIN_USERS_LOAD_FAILED,
      feature: OPERATIONAL_ERROR_FEATURES.ADMIN_USERS,
      message: "관리자 사용자 목록 조회에 실패했습니다.",
      operation: OPERATIONAL_ERROR_OPERATIONS.GET_ADMIN_USERS,
      severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
      stage: OPERATIONAL_ERROR_STAGES.USER_LIST_QUERY,
    });

    throw new Error(`Failed to load admin users: ${error.message}`);
  }

  const rows = (data ?? []) as AdminUserListRow[];
  const items = mapUserRows(rows);
  const total = count ?? rows.length;

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
