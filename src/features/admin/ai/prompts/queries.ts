"use server";

import { z } from "zod";

import { aiPromptAgentRowSchema } from "@/features/ai/prompts/schema";
import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

import { requireAdmin } from "../../utils/require-admin";
import { aiPromptFamilyRowSchema, aiPromptVersionRowSchema } from "../schema";
import {
  getDateRangeRpcFrom,
  getDateRangeRpcTo,
  getMultiSelectRpcValues,
  getNumberRangeRpcMax,
  getNumberRangeRpcMin,
} from "../utils/list-rpc";
import { mapFamilyRow, mapVersionRow } from "../utils/load-admin-prompt-graph";
import { reportAdminAiLoadError } from "../utils/report-load-error";
import {
  adminAiPromptFamilyListRpcResultSchema,
  adminAiPromptFamilyListRpcRowSchema,
} from "./schema";
import type {
  AdminAiPromptFamilyDetail,
  AdminAiPromptFamilyListRow,
  AdminAiPromptFamilyOption,
  AdminAiPromptListQuery,
  AdminAiPromptListResult,
  AdminAiPromptVersionOption,
} from "./types";

export type GetAdminAiPromptListRpcArgs =
  Database["public"]["Functions"]["get_admin_ai_prompt_family_list"]["Args"];

/**
 * Prompt Family 목록 RPC row를 화면 표시 모델로 변환합니다.
 *
 * @param row Prompt Family 목록 RPC row
 * @returns 관리자 Prompt Family 목록 행
 */
function mapPromptFamilyListRpcRow(
  row: z.infer<typeof adminAiPromptFamilyListRpcRowSchema>,
): AdminAiPromptFamilyListRow {
  return {
    agentDisplayName: row.agent_display_name,
    agentId: row.agent_id,
    archivedVersionCount: row.archived_version_count,
    createdAt: row.created_at,
    displayName: row.display_name,
    draftVersionCount: row.draft_version_count,
    id: row.id,
    publishedVersionCount: row.published_version_count,
    updatedAt: row.updated_at,
  };
}

/**
 * Prompt Family 상세 조회 실패를 운영 오류로 보고합니다.
 *
 * @param input 조회 실패 정보
 */
async function reportPromptFamilyDetailLoadError(input: {
  adminUserId: string;
  error: unknown;
  familyId: string;
}) {
  await reportAdminAiLoadError({
    adminUserId: input.adminUserId,
    context: {
      familyId: input.familyId,
    },
    error: input.error,
    errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_FAMILY_LOAD_FAILED,
    message: "관리자 AI prompt family 상세 조회에 실패했습니다.",
    operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_FAMILY,
    stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
  });
}

/**
 * Prompt Version 목록 조회 실패를 운영 오류로 보고합니다.
 *
 * @param input 조회 실패 정보
 */
async function reportPromptVersionListLoadError(input: {
  adminUserId: string;
  error: unknown;
  familyId: string;
}) {
  await reportAdminAiLoadError({
    adminUserId: input.adminUserId,
    context: {
      familyId: input.familyId,
    },
    error: input.error,
    errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_VERSION_LOAD_FAILED,
    message: "관리자 AI prompt version 목록 조회에 실패했습니다.",
    operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_VERSION,
    stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
  });
}

/**
 * Prompt Family 선택 목록 조회 실패를 운영 오류로 보고합니다.
 *
 * @param input 조회 실패 정보
 */
async function reportPromptFamilyOptionsLoadError(input: {
  adminUserId: string;
  agentId: string;
  error: unknown;
}) {
  await reportAdminAiLoadError({
    adminUserId: input.adminUserId,
    context: {
      agentId: input.agentId,
    },
    error: input.error,
    errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_FAMILY_LOAD_FAILED,
    message: "관리자 AI prompt family 선택 목록 조회에 실패했습니다.",
    operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_FAMILY_OPTIONS,
    stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
  });
}

/**
 * Prompt Version 선택 목록 조회 실패를 운영 오류로 보고합니다.
 *
 * @param input 조회 실패 정보
 */
async function reportPromptVersionOptionsLoadError(input: {
  adminUserId: string;
  error: unknown;
  familyId: string;
}) {
  await reportAdminAiLoadError({
    adminUserId: input.adminUserId,
    context: {
      familyId: input.familyId,
    },
    error: input.error,
    errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_VERSION_LOAD_FAILED,
    message: "관리자 AI prompt version 선택 목록 조회에 실패했습니다.",
    operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_VERSION_OPTIONS,
    stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
  });
}

/**
 * Prompt Family 목록 RPC에 전달할 파라미터를 생성합니다.
 *
 * @param query 목록 검색, 필터, 정렬, 페이지네이션 조건
 * @returns Supabase RPC 파라미터
 */
function createAdminAiPromptListRpcArgs(query: AdminAiPromptListQuery) {
  return {
    p_agent_id_filters: getMultiSelectRpcValues(query.filters.agentId),
    p_archived_count_max: getNumberRangeRpcMax(
      query.filters.archivedVersionCount,
    ),
    p_archived_count_min: getNumberRangeRpcMin(
      query.filters.archivedVersionCount,
    ),
    p_created_from: getDateRangeRpcFrom(query.filters.createdAt),
    p_created_to: getDateRangeRpcTo(query.filters.createdAt),
    p_draft_count_max: getNumberRangeRpcMax(query.filters.draftVersionCount),
    p_draft_count_min: getNumberRangeRpcMin(query.filters.draftVersionCount),
    p_page: query.page,
    p_page_size: query.pageSize,
    p_published_count_max: getNumberRangeRpcMax(
      query.filters.publishedVersionCount,
    ),
    p_published_count_min: getNumberRangeRpcMin(
      query.filters.publishedVersionCount,
    ),
    p_search_field: query.search.field,
    p_search_query: query.search.query,
    p_sort_direction: query.sort.direction,
    p_sort_field: query.sort.field,
    p_updated_from: getDateRangeRpcFrom(query.filters.updatedAt),
    p_updated_to: getDateRangeRpcTo(query.filters.updatedAt),
  };
}

/**
 * 관리자 AI Prompt Family 목록 응답 검증 실패를 운영 오류로 보고합니다.
 *
 * @param input 목록 응답 검증 실패 정보
 */
async function reportPromptFamilyListResponseValidationError(input: {
  adminUserId: string;
  error: unknown;
  page: number;
  pageSize: number;
  query: AdminAiPromptListQuery;
}) {
  await reportAdminAiLoadError({
    adminUserId: input.adminUserId,
    context: {
      page: input.page,
      pageSize: input.pageSize,
      searchField: input.query.search.field,
      searchQueryApplied: input.query.search.query.trim().length > 0,
      sortDirection: input.query.sort.direction,
      sortField: input.query.sort.field,
    },
    error: input.error,
    errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
    message: "관리자 AI prompt family 목록 응답 검증에 실패했습니다.",
    operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
    stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
  });
}

/**
 * 관리자 AI prompt family 목록을 조회합니다.
 *
 * @param query 목록 검색, 필터, 정렬, 페이지네이션 조건
 * @returns 관리자 AI prompt family 목록 결과
 */
export async function getAdminAiPromptFamilies(
  query: AdminAiPromptListQuery,
): Promise<AdminAiPromptListResult> {
  const adminUserId = await requireAdmin();

  const supabase = createAdminClient();
  const page = Math.max(1, query.page);
  const pageSize = query.pageSize;

  const rpcArgs = createAdminAiPromptListRpcArgs({
    ...query,
    page,
  });

  const { data, error } = await supabase.rpc(
    "get_admin_ai_prompt_family_list",
    rpcArgs as GetAdminAiPromptListRpcArgs,
  );

  if (error) {
    await reportAdminAiLoadError({
      adminUserId,
      context: {
        page,
        pageSize,
        searchField: query.search.field,
        searchQueryApplied: query.search.query.trim().length > 0,
        sortDirection: query.sort.direction,
        sortField: query.sort.field,
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_FAMILY_LOAD_FAILED,
      message: "관리자 AI prompt family 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_FAMILY,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(
      `Failed to load admin AI prompt families: ${error.message}`,
    );
  }

  let rpcResults: z.infer<typeof adminAiPromptFamilyListRpcResultSchema>;

  try {
    rpcResults = adminAiPromptFamilyListRpcResultSchema.parse(data ?? []);
  } catch (error) {
    await reportPromptFamilyListResponseValidationError({
      adminUserId,
      error,
      page,
      pageSize,
      query,
    });

    throw error;
  }

  // RPC 계약과 schema의 length(1) 검증으로 최상위 결과가 정확히 1개임이 보장된다.
  const rpcResult = rpcResults[0]!;

  let rows: AdminAiPromptFamilyListRow[];

  try {
    rows = z
      .array(adminAiPromptFamilyListRpcRowSchema)
      .parse(rpcResult.items)
      .map(mapPromptFamilyListRpcRow);
  } catch (error) {
    await reportPromptFamilyListResponseValidationError({
      adminUserId,
      error,
      page,
      pageSize,
      query,
    });

    throw error;
  }

  const total = rpcResult.total_count;

  return {
    items: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * 관리자 AI prompt family 상세를 조회합니다.
 *
 * @param familyId 조회할 ai_prompt_families.id
 * @returns prompt family 상세 또는 null
 */
export async function getAdminAiPromptFamilyDetail(
  familyId: string,
): Promise<AdminAiPromptFamilyDetail | null> {
  const adminUserId = await requireAdmin();
  const supabase = createAdminClient();
  const { data: familyRow, error: familyError } = await supabase
    .from("ai_prompt_families")
    .select("id,agent_id,display_name,description,tags,created_at,updated_at")
    .eq("id", familyId)
    .maybeSingle();

  if (familyError) {
    await reportPromptFamilyDetailLoadError({
      adminUserId,
      error: familyError,
      familyId,
    });

    throw new Error(
      `Failed to load admin AI prompt family detail: ${familyError.message}`,
    );
  }

  if (!familyRow) {
    return null;
  }

  const parsedFamilyRow = aiPromptFamilyRowSchema.parse(familyRow);

  const [agentResult, versionsResult] = await Promise.all([
    supabase
      .from("ai_prompt_agents")
      .select("id,display_name,description,purpose,tags,created_at,updated_at")
      .eq("id", parsedFamilyRow.agent_id)
      .maybeSingle(),
    supabase
      .from("ai_prompt_versions")
      .select(
        "id,family_id,version_number,display_name,change_summary,lifecycle_status,system_template,user_template,response_schema,variables,tags,created_by_kind,created_by,created_at",
      )
      .eq("family_id", parsedFamilyRow.id)
      .order("version_number", { ascending: false }),
  ]);

  if (agentResult.error) {
    await reportAdminAiLoadError({
      adminUserId,
      context: {
        agentId: parsedFamilyRow.agent_id,
        familyId,
      },
      error: agentResult.error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_LOAD_FAILED,
      message: "관리자 AI prompt family의 agent 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_AGENT,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(
      `Failed to load admin AI prompt family agent: ${agentResult.error.message}`,
    );
  }

  if (versionsResult.error) {
    await reportPromptVersionListLoadError({
      adminUserId,
      error: versionsResult.error,
      familyId,
    });

    throw new Error(
      `Failed to load admin AI prompt versions: ${versionsResult.error.message}`,
    );
  }

  const parsedAgentRow = agentResult.data
    ? aiPromptAgentRowSchema.parse(agentResult.data)
    : null;
  const versions = z
    .array(aiPromptVersionRowSchema)
    .parse(versionsResult.data ?? [])
    .map(mapVersionRow);
  const family = mapFamilyRow(
    parsedFamilyRow,
    parsedAgentRow?.display_name ?? "(missing-agent)",
    versions,
  );

  return {
    ...family,
    versions,
  };
}

/**
 * 관리자 AI prompt version 상세를 조회합니다.
 *
 * @param familyId version이 속한 family id
 * @param versionId 조회할 ai_prompt_versions.id
 * @returns prompt version 상세 또는 null
 */
export async function getAdminAiPromptVersionDetail(
  familyId: string,
  versionId: string,
) {
  const family = await getAdminAiPromptFamilyDetail(familyId);

  if (!family) {
    return null;
  }

  const version = family.versions.find((row) => row.id === versionId) ?? null;

  if (!version) {
    return null;
  }

  return {
    family,
    version,
  };
}

/**
 * 지정한 Agent에 속한 Prompt Family 선택 목록을 조회합니다.
 *
 * @param agentId Prompt Family가 속한 Agent ID
 * @returns 표시 이름순으로 정렬된 Prompt Family 목록
 */
export async function getAdminAiPromptFamilyOptions(
  agentId: string,
): Promise<AdminAiPromptFamilyOption[]> {
  const adminUserId = await requireAdmin();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_prompt_families")
    .select("id,agent_id,display_name")
    .eq("agent_id", agentId)
    .order("display_name", { ascending: true });

  if (error) {
    await reportPromptFamilyOptionsLoadError({
      adminUserId,
      agentId,
      error,
    });

    throw new Error(
      `Failed to load admin AI prompt family options: ${error.message}`,
    );
  }

  return z
    .array(
      z.object({
        agent_id: z.string().uuid(),
        display_name: z.string(),
        id: z.string().uuid(),
      }),
    )
    .parse(data ?? [])
    .map((family) => ({
      agentId: family.agent_id,
      displayName: family.display_name,
      id: family.id,
    }));
}

/**
 * 지정한 Prompt Family에 속한 published Version 선택 목록을 조회합니다.
 *
 * @param familyId Prompt Version이 속한 Family ID
 * @returns 버전 번호 내림차순으로 정렬된 published Prompt Version 목록
 */
export async function getAdminAiPromptVersionOptions(
  familyId: string,
): Promise<AdminAiPromptVersionOption[]> {
  const adminUserId = await requireAdmin();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_prompt_versions")
    .select("id,family_id,display_name,version_number")
    .eq("family_id", familyId)
    .eq("lifecycle_status", "published")
    .order("version_number", { ascending: false });

  if (error) {
    await reportPromptVersionOptionsLoadError({
      adminUserId,
      error,
      familyId,
    });

    throw new Error(
      `Failed to load admin AI prompt version options: ${error.message}`,
    );
  }

  return z
    .array(
      z.object({
        display_name: z.string(),
        family_id: z.string().uuid(),
        id: z.string().uuid(),
        version_number: z.number(),
      }),
    )
    .parse(data ?? [])
    .map((version) => ({
      displayName: version.display_name,
      familyId: version.family_id,
      id: version.id,
      versionNumber: version.version_number,
    }));
}
