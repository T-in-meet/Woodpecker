"use server";

import { z } from "zod";

import { aiPromptAgentRowSchema } from "@/features/ai/prompts/schema";
import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { Database } from "@/types/database.types";

import { requireAdmin } from "../../utils/require-admin";
import { aiPromptFamilyRowSchema, aiPromptVersionRowSchema } from "../schema";
import type { AdminAiPromptVersionRow } from "../types";
import {
  getDateRangeRpcFrom,
  getDateRangeRpcTo,
  getNumberRangeRpcMax,
  getNumberRangeRpcMin,
} from "../utils/list-rpc";
import {
  mapAgentRow,
  mapFamilyRow,
  mapVersionRow,
} from "../utils/load-admin-prompt-graph";
import { reportAdminAiLoadError } from "../utils/report-load-error";
import {
  adminAiAgentListRpcResultSchema,
  adminAiAgentListRpcRowSchema,
  adminAiAgentOptionRowSchema,
} from "./schema";
import type {
  AdminAiAgentDetail,
  AdminAiAgentListQuery,
  AdminAiAgentListResult,
  AdminAiAgentListRow,
} from "./types";

type GetAdminAiAgentListRpcArgs =
  Database["public"]["Functions"]["get_admin_ai_agent_list"]["Args"];

/**
 * Agent 목록 RPC row를 화면 표시 모델로 변환합니다.
 *
 * @param row Agent 목록 RPC row
 * @returns 관리자 Agent 목록 행
 */
function mapAgentListRpcRow(
  row: z.infer<typeof adminAiAgentListRpcRowSchema>,
): AdminAiAgentListRow {
  return {
    createdAt: row.created_at,
    displayName: row.display_name,
    familyCount: row.family_count,
    id: row.id,
    purpose: row.purpose,
    updatedAt: row.updated_at,
  };
}

/**
 * Agent 목록 RPC에 전달할 파라미터를 생성합니다.
 *
 * @param query 목록 검색, 필터, 정렬, 페이지네이션 조건
 * @returns Supabase RPC 파라미터
 */
function createAdminAiAgentListRpcArgs(query: AdminAiAgentListQuery) {
  return {
    p_created_from: getDateRangeRpcFrom(query.filters.createdAt),
    p_created_to: getDateRangeRpcTo(query.filters.createdAt),
    p_family_count_max: getNumberRangeRpcMax(query.filters.familyCount),
    p_family_count_min: getNumberRangeRpcMin(query.filters.familyCount),
    p_page: query.page,
    p_page_size: query.pageSize,
    p_search_field: query.search.field,
    p_search_query: query.search.query,
    p_sort_direction: query.sort.direction,
    p_sort_field: query.sort.field,
    p_updated_from: getDateRangeRpcFrom(query.filters.updatedAt),
    p_updated_to: getDateRangeRpcTo(query.filters.updatedAt),
  };
}

/**
 * 관리자 AI agent 목록 응답 검증 실패를 운영 오류로 보고합니다.
 *
 * @param input 목록 응답 검증 실패 정보
 */
async function reportAgentListResponseValidationError(input: {
  adminUserId: string;
  error: unknown;
  page: number;
  pageSize: number;
  query: AdminAiAgentListQuery;
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
    message: "관리자 AI agent 목록 응답 검증에 실패했습니다.",
    operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
    stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
  });
}

/**
 * 관리자 AI agent 목록을 조회합니다.
 *
 * @param query 목록 검색, 필터, 정렬, 페이지네이션 조건
 * @returns 관리자 AI agent 목록 결과
 */
export async function getAdminAiAgents(
  query: AdminAiAgentListQuery,
): Promise<AdminAiAgentListResult> {
  const adminUserId = await requireAdmin();

  const supabase = createAdminClient();
  const page = Math.max(1, query.page);
  const pageSize = query.pageSize;

  const rpcArgs = createAdminAiAgentListRpcArgs({
    ...query,
    page,
  });

  const { data, error } = await supabase.rpc(
    "get_admin_ai_agent_list",
    rpcArgs as GetAdminAiAgentListRpcArgs,
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
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_LOAD_FAILED,
      message: "관리자 AI agent 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_AGENT,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(`Failed to load admin AI agents: ${error.message}`);
  }

  let rpcResults: z.infer<typeof adminAiAgentListRpcResultSchema>;

  try {
    rpcResults = adminAiAgentListRpcResultSchema.parse(data ?? []);
  } catch (error) {
    await reportAgentListResponseValidationError({
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

  let rows: AdminAiAgentListRow[];

  try {
    rows = z
      .array(adminAiAgentListRpcRowSchema)
      .parse(rpcResult.items)
      .map(mapAgentListRpcRow);
  } catch (error) {
    await reportAgentListResponseValidationError({
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
 * 관리자 AI agent 상세를 조회합니다.
 *
 * @param agentId 조회할 ai_prompt_agents.id
 * @returns agent 상세 또는 null
 */
export async function getAdminAiAgentDetail(
  agentId: string,
): Promise<AdminAiAgentDetail | null> {
  const adminUserId = await requireAdmin();
  const supabase = createAdminClient();
  const { data: agentRow, error: agentError } = await supabase
    .from("ai_prompt_agents")
    .select("id,display_name,description,purpose,tags,created_at,updated_at")
    .eq("id", agentId)
    .maybeSingle();

  if (agentError) {
    await reportAdminAiLoadError({
      adminUserId,
      context: {
        agentId,
      },
      error: agentError,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_LOAD_FAILED,
      message: "관리자 AI agent 상세 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_AGENT,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(
      `Failed to load admin AI agent detail: ${agentError.message}`,
    );
  }

  if (!agentRow) {
    return null;
  }

  const parsedAgentRow = aiPromptAgentRowSchema.parse(agentRow);
  const { data: familyRows, error: familyError } = await supabase
    .from("ai_prompt_families")
    .select("id,agent_id,display_name,description,tags,created_at,updated_at")
    .eq("agent_id", parsedAgentRow.id)
    .order("display_name", { ascending: true });

  if (familyError) {
    await reportAdminAiLoadError({
      adminUserId,
      context: {
        agentId,
      },
      error: familyError,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_FAMILY_LOAD_FAILED,
      message: "관리자 AI agent의 prompt family 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_FAMILY,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(
      `Failed to load admin AI agent prompt families: ${familyError.message}`,
    );
  }

  const parsedFamilyRows = z
    .array(aiPromptFamilyRowSchema)
    .parse(familyRows ?? []);
  const familyIds = parsedFamilyRows.map((familyRow) => familyRow.id);
  const versionRows =
    familyIds.length > 0
      ? await supabase
          .from("ai_prompt_versions")
          .select(
            "id,family_id,version_number,display_name,change_summary,lifecycle_status,system_template,user_template,response_schema,variables,tags,created_by_kind,created_by,created_at",
          )
          .in("family_id", familyIds)
      : {
          data: [],
          error: null,
        };

  if (versionRows.error) {
    await reportAdminAiLoadError({
      adminUserId,
      context: {
        agentId,
      },
      error: versionRows.error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_VERSION_LOAD_FAILED,
      message: "관리자 AI agent의 prompt version 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_VERSION,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(
      `Failed to load admin AI agent prompt versions: ${versionRows.error.message}`,
    );
  }

  const versionsByFamilyId = new Map<string, AdminAiPromptVersionRow[]>(
    familyIds.map((familyId) => [familyId, []]),
  );

  /*
   * Family별 최신 Version이 먼저 표시되도록 scoped 조회 결과를 versionNumber
   * 내림차순으로 정렬한 뒤 그룹화한다.
   */
  for (const version of z
    .array(aiPromptVersionRowSchema)
    .parse(versionRows.data ?? [])
    .map(mapVersionRow)
    .sort((left, right) => right.versionNumber - left.versionNumber)) {
    const versions = versionsByFamilyId.get(version.familyId) ?? [];
    versions.push(version);
    versionsByFamilyId.set(version.familyId, versions);
  }

  const families = parsedFamilyRows.map((familyRow) =>
    mapFamilyRow(
      familyRow,
      parsedAgentRow.display_name,
      versionsByFamilyId.get(familyRow.id) ?? [],
    ),
  );
  const agent = mapAgentRow(parsedAgentRow, families, versionsByFamilyId);

  return {
    ...agent,
    families,
  };
}

/**
 * 관리자 AI prompt 생성 화면의 agent 선택 목록을 조회합니다.
 *
 * @returns agent 선택 항목 목록
 */
export async function getAdminAiAgentOptions() {
  const adminUserId = await requireAdmin();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_prompt_agents")
    .select("id,display_name")
    .order("display_name", { ascending: true });

  if (error) {
    await reportAdminAiLoadError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_LOAD_FAILED,
      message: "관리자 AI agent 선택 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_AGENT_OPTIONS,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(`Failed to load admin AI agent options: ${error.message}`);
  }

  return z
    .array(adminAiAgentOptionRowSchema)
    .parse(data ?? [])
    .map((agent) => ({
      displayName: agent.display_name,
      id: agent.id,
    }));
}
