"use server";

import { z } from "zod";

import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { Database } from "@/types/database.types";

import { requireAdmin } from "../../utils/require-admin";
import {
  getDateRangeRpcFrom,
  getDateRangeRpcTo,
  getNumberRangeRpcMax,
  getNumberRangeRpcMin,
} from "../utils/list-rpc";
import { reportAdminAiLoadError } from "../utils/report-load-error";
import {
  adminAiAgentListRpcResultSchema,
  adminAiAgentListRpcRowSchema,
  adminAiAgentOptionRowSchema,
  adminAiAgentRowSchema,
} from "./schema";
import type {
  AdminAiAgentDetail,
  AdminAiAgentListQuery,
  AdminAiAgentListResult,
  AdminAiAgentListRow,
  AdminAiAgentRow,
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
 * Agent DB row를 상세 화면 모델로 변환합니다.
 *
 * @param row Agent DB row
 * @returns 관리자 Agent 상세 행
 */
function mapAgentRow(
  row: z.infer<typeof adminAiAgentRowSchema>,
): AdminAiAgentRow {
  return {
    createdAt: row.created_at,
    description: row.description,
    displayName: row.display_name,
    familyCount: 0,
    id: row.id,
    purpose: row.purpose,
    tags: row.tags,
    updatedAt: row.updated_at,
    versionCount: 0,
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
  const { data, error } = await supabase
    .from("ai_prompt_agents")
    .select("id,display_name,description,purpose,tags,created_at,updated_at")
    .eq("id", agentId)
    .maybeSingle();

  if (error) {
    await reportAdminAiLoadError({
      adminUserId,
      context: {
        agentId,
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_LOAD_FAILED,
      message: "관리자 AI agent 상세 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_AGENT,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(`Failed to load admin AI agent: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const agent = mapAgentRow(adminAiAgentRowSchema.parse(data));

  return {
    ...agent,
    families: [],
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
