"use server";

import { notFound } from "next/navigation";

import {
  ADMIN_OPERATIONAL_ERROR_CODES,
  ADMIN_OPERATIONAL_ERROR_OPERATIONS,
  ADMIN_OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../utils/require-admin";
import { ADMIN_OPERATIONAL_ERROR_SORT_COLUMN } from "./constants/operational-error-list";
import type {
  OperationalErrorDetail,
  OperationalErrorListQuery,
  OperationalErrorListResult,
} from "./types/operational-error-list";
import type {
  OperationalErrorRow,
  OperationalErrorStatusHistoryRow,
} from "./types/operational-error-query";
import { applyOperationalErrorFilters } from "./utils/operational-error-filter";
import {
  mapHistoryRow,
  mapOperationalErrorRow,
} from "./utils/operational-error-mapper";
import { applyOperationalErrorSearch } from "./utils/operational-error-search";
import { recordAdminOperationalError } from "./utils/record-admin-operational-error";

export async function getOperationalErrors(
  listQuery: OperationalErrorListQuery,
): Promise<OperationalErrorListResult> {
  const adminUserId = await requireAdmin();

  const supabase = createAdminClient();
  const page = Math.max(1, listQuery.page);
  const pageSize = listQuery.pageSize;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sortColumn = ADMIN_OPERATIONAL_ERROR_SORT_COLUMN[listQuery.sort.field];

  let query = supabase
    .from("operational_errors")
    .select(
      "id, feature, operation, stage, error_code, severity, status, message, user_id, fingerprint, occurrence_count, last_seen_at, created_at, context",
      { count: "exact" },
    );

  query = applyOperationalErrorFilters(query, listQuery.filters);
  query = applyOperationalErrorSearch(query, listQuery.search);

  const { data, error, count } = await query
    .order(sortColumn, { ascending: listQuery.sort.direction === "asc" })
    .range(from, to);

  if (error) {
    await recordAdminOperationalError({
      actorUserId: adminUserId,
      code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_LIST_FAILED,
      context: {
        page,
        pageSize,
        searchField: listQuery.search.field,
        sortDirection: listQuery.sort.direction,
        sortField: listQuery.sort.field,
      },
      error,
      message: "운영 오류 목록을 불러오지 못했습니다.",
      operation: ADMIN_OPERATIONAL_ERROR_OPERATIONS.LIST_OPERATIONAL_ERRORS,
      stage: ADMIN_OPERATIONAL_ERROR_STAGES.LIST_QUERY,
    });

    throw new Error(`Failed to load operational errors: ${error.message}`);
  }

  const rows = (data ?? []) as OperationalErrorRow[];

  return {
    items: rows.map(mapOperationalErrorRow),
    pagination: {
      page,
      pageSize,
      total: count ?? rows.length,
      totalPages: Math.ceil((count ?? rows.length) / pageSize),
    },
  };
}

/**
 * 운영 오류 상세 정보와 상태 변경 이력을 조회합니다.
 *
 * 운영 오류 본문, 관련 사용자 표시 이름, 해결 정보와 함께
 * 해당 오류에 저장된 전체 상태 변경 이력을 최신순으로 반환합니다.
 *
 * @param operationalErrorId 조회할 운영 오류 ID
 * @returns 운영 오류 상세 정보
 */
export async function getOperationalErrorDetail(
  operationalErrorId: string,
): Promise<OperationalErrorDetail> {
  /** 관리자 권한이 있는 사용자만 운영 오류 상세 정보를 조회할 수 있습니다. */
  const adminUserId = await requireAdmin();

  const supabase = createAdminClient();

  /**
   * 운영 오류의 기본 정보와 진단에 필요한 문맥 정보를 조회합니다.
   *
   * 상세 페이지에서 사용하는 필드만 명시적으로 선택하며,
   * 전달된 ID와 일치하는 단일 운영 오류를 가져옵니다.
   */
  const { data, error } = await supabase
    .from("operational_errors")
    .select(
      "id, feature, operation, stage, error_code, severity, status, message, user_id, actor_user_id, fingerprint, occurrence_count, first_seen_at, last_seen_at, resolved_at, resolved_by, resolution_note, created_at, updated_at, context",
    )
    .eq("id", operationalErrorId)
    .maybeSingle();

  /** 운영 오류 조회 실패를 기록한 후 예외로 처리합니다. */
  if (error) {
    await recordAdminOperationalError({
      actorUserId: adminUserId,
      code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_DETAIL_FAILED,
      context: {
        operationalErrorId,
      },
      error,
      message: "운영 오류 상세 정보를 불러오지 못했습니다.",
      operation:
        ADMIN_OPERATIONAL_ERROR_OPERATIONS.GET_OPERATIONAL_ERROR_DETAIL,
      stage: ADMIN_OPERATIONAL_ERROR_STAGES.DETAIL_QUERY,
    });

    throw new Error(
      `Failed to load operational error detail: ${error.message}`,
    );
  }

  /** 요청한 운영 오류가 존재하지 않으면 404 응답을 처리합니다. */
  if (!data) {
    notFound();
  }

  const row = data as OperationalErrorRow;

  /**
   * 해당 운영 오류에 연결된 전체 상태 변경 이력을 조회합니다.
   *
   * 최신 처리 이력이 배열의 첫 번째에 위치하도록 생성 시각을 기준으로
   * 내림차순 정렬합니다. 조회 개수 제한은 적용하지 않습니다.
   */
  const { data: historyRows, error: historyError } = await supabase
    .from("operational_error_status_history")
    .select("id, from_status, to_status, note, changed_by, created_at")
    .eq("operational_error_id", operationalErrorId)
    .order("created_at", { ascending: false });

  /** 처리 이력 조회 실패는 상세 정보 조회 실패로 처리합니다. */
  if (historyError) {
    await recordAdminOperationalError({
      actorUserId: adminUserId,
      code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_HISTORY_FAILED,
      context: {
        operationalErrorId,
      },
      error: historyError,
      message: "운영 오류 처리 이력을 불러오지 못했습니다.",
      operation:
        ADMIN_OPERATIONAL_ERROR_OPERATIONS.GET_OPERATIONAL_ERROR_DETAIL,
      stage: ADMIN_OPERATIONAL_ERROR_STAGES.HISTORY_QUERY,
    });

    throw new Error(
      `Failed to load operational error history: ${historyError.message}`,
    );
  }

  const history = (historyRows ?? []) as OperationalErrorStatusHistoryRow[];

  /**
   * 운영 오류와 처리 이력에서 표시 이름이 필요한 사용자 ID를 수집합니다.
   *
   * 오류 대상 사용자, 오류 발생 행위자, 최종 처리자와 모든 이력 작성자를
   * 하나의 배열로 합치고 중복 및 null 값을 제거합니다.
   */
  const profileIds = Array.from(
    new Set(
      [
        row.user_id,
        row.actor_user_id,
        row.resolved_by,
        ...history.map((item) => item.changed_by),
      ].filter((id): id is string => id !== null),
    ),
  );

  /** 사용자 ID를 화면에 표시할 닉네임으로 변환하기 위한 매핑입니다. */
  const profileLabels = new Map<string, string>();

  /**
   * 표시 이름이 필요한 사용자가 존재할 때만 프로필을 조회합니다.
   *
   * 조회된 프로필은 이후 운영 오류 정보와 처리 이력 매핑 과정에서
   * 사용자 ID 대신 닉네임을 표시하는 데 사용합니다.
   */
  if (profileIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", profileIds);

    /** 프로필 조회 실패는 상세 정보 조회 실패로 처리합니다. */
    if (profilesError) {
      await recordAdminOperationalError({
        actorUserId: adminUserId,
        code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_PROFILES_FAILED,
        context: {
          operationalErrorId,
          profileCount: profileIds.length,
          profileIds,
        },
        error: profilesError,
        message: "운영 오류 관련 사용자 정보를 불러오지 못했습니다.",
        operation:
          ADMIN_OPERATIONAL_ERROR_OPERATIONS.GET_OPERATIONAL_ERROR_DETAIL,
        stage: ADMIN_OPERATIONAL_ERROR_STAGES.PROFILE_QUERY,
      });

      throw new Error(
        `Failed to load operational error profiles: ${profilesError.message}`,
      );
    }

    for (const profile of profiles ?? []) {
      profileLabels.set(profile.id, profile.nickname ?? profile.id);
    }
  }

  /**
   * 데이터베이스 조회 결과를 상세 페이지에서 사용하는 형태로 변환합니다.
   *
   * 프로필이 조회되지 않은 사용자는 닉네임 대신 사용자 ID를 표시하며,
   * 처리 이력은 조회된 전체 배열을 각각 화면용 타입으로 변환합니다.
   */
  return {
    ...mapOperationalErrorRow(row),
    actorUserId: row.actor_user_id,
    actorUserLabel: row.actor_user_id
      ? (profileLabels.get(row.actor_user_id) ?? row.actor_user_id)
      : null,
    firstSeenAt: row.first_seen_at,
    history: history.map((item) => mapHistoryRow(item, profileLabels)),
    resolutionNote: row.resolution_note,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolvedByLabel: row.resolved_by
      ? (profileLabels.get(row.resolved_by) ?? row.resolved_by)
      : null,
    updatedAt: row.updated_at,
    userLabel: row.user_id
      ? (profileLabels.get(row.user_id) ?? row.user_id)
      : null,
  };
}
