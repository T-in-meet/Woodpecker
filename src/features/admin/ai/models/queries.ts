"use server";

import { z } from "zod";

import { AiModelCapability } from "@/features/ai/constants/models";
import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
  type AdminAiOperationalErrorOperation,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

import { requireAdmin } from "../../utils/require-admin";
import {
  getDateRangeRpcFrom,
  getDateRangeRpcTo,
  getMultiSelectRpcValues,
  getNumberRangeRpcMax,
  getNumberRangeRpcMin,
  getSelectBooleanRpcValue,
} from "../utils/list-rpc";
import { reportAdminAiLoadError } from "../utils/report-load-error";
import { mapModelListRpcRow, mapModelRow } from "./mappers";
import {
  adminAiModelConfigOptionRowSchema,
  adminAiModelListRpcResultSchema,
  adminAiModelListRpcRowSchema,
  aiEmbeddingReferenceRowSchema,
  aiModelConfigRowSchema,
} from "./schema";
import type {
  AdminAiModelConfigOption,
  AdminAiModelListQuery,
  AdminAiModelListResult,
} from "./types";

export type GetAdminAiModelListRpcArgs =
  Database["public"]["Functions"]["get_admin_ai_model_list"]["Args"];

/**
 * 모델 목록 RPC에 전달할 파라미터를 생성합니다.
 *
 * @param query 목록 검색, 필터, 정렬, 페이지네이션 조건
 * @returns Supabase RPC 파라미터
 */
function createAdminAiModelListRpcArgs(query: AdminAiModelListQuery) {
  return {
    p_capability_filters: getMultiSelectRpcValues(query.filters.capability),
    p_created_from: getDateRangeRpcFrom(query.filters.createdAt),
    p_created_to: getDateRangeRpcTo(query.filters.createdAt),
    p_is_active_filter: getSelectBooleanRpcValue(query.filters.isActive),
    p_page: query.page,
    p_page_size: query.pageSize,
    p_provider_filters: getMultiSelectRpcValues(query.filters.provider),
    p_reference_count_max: getNumberRangeRpcMax(
      query.filters.embeddingReferenceCount,
    ),
    p_reference_count_min: getNumberRangeRpcMin(
      query.filters.embeddingReferenceCount,
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
 * 관리자 AI 모델 조회 실패를 운영 오류로 보고합니다.
 *
 * @param input 조회 실패 정보
 */
async function reportModelLoadError(input: {
  adminUserId: string;
  context?: Record<string, boolean | number | string>;
  error: unknown;
  message: string;
  operation: AdminAiOperationalErrorOperation;
}) {
  await reportAdminAiLoadError({
    adminUserId: input.adminUserId,
    ...(input.context !== undefined ? { context: input.context } : {}),
    error: input.error,
    errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_LOAD_FAILED,
    message: input.message,
    operation: input.operation,
    stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
  });
}

/**
 * 관리자 AI 모델 목록 응답 검증 실패를 운영 오류로 보고합니다.
 *
 * @param input 목록 응답 검증 실패 정보
 */
async function reportModelListResponseValidationError(input: {
  adminUserId: string;
  error: unknown;
  page: number;
  pageSize: number;
  query: AdminAiModelListQuery;
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
    message: "관리자 AI 모델 목록 응답 검증에 실패했습니다.",
    operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
    stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
  });
}

/**
 * 관리자 AI 모델 목록을 조회합니다.
 *
 * @param query 목록 검색, 필터, 정렬, 페이지네이션 조건
 * @returns 관리자 AI 모델 목록 결과
 */
export async function getAdminAiModels(
  query: AdminAiModelListQuery,
): Promise<AdminAiModelListResult> {
  const adminUserId = await requireAdmin();
  const supabase = createAdminClient();
  const page = Math.max(1, query.page);
  const pageSize = query.pageSize;

  const rpcArgs = createAdminAiModelListRpcArgs({
    ...query,
    page,
  });

  const { data, error } = await supabase.rpc(
    "get_admin_ai_model_list",
    rpcArgs as GetAdminAiModelListRpcArgs,
  );

  if (error) {
    await reportModelLoadError({
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
      message: "관리자 AI 모델 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG,
    });

    throw new Error(`Failed to load admin AI models: ${error.message}`);
  }

  let rpcResults: z.infer<typeof adminAiModelListRpcResultSchema>;

  try {
    rpcResults = adminAiModelListRpcResultSchema.parse(data ?? []);
  } catch (error) {
    await reportModelListResponseValidationError({
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

  let rows: ReturnType<typeof mapModelListRpcRow>[];

  try {
    rows = z
      .array(adminAiModelListRpcRowSchema)
      .parse(rpcResult.items)
      .map(mapModelListRpcRow);
  } catch (error) {
    await reportModelListResponseValidationError({
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
 * 관리자 AI 모델 상세를 조회합니다.
 *
 * @param modelConfigId 조회할 ai_model_configs.id
 * @returns 모델 상세 또는 null
 */
export async function getAdminAiModelDetail(modelConfigId: string) {
  const adminUserId = await requireAdmin();
  const supabase = createAdminClient();
  const { data: modelRow, error: modelError } = await supabase
    .from("ai_model_configs")
    .select(
      "id,display_name,provider,model,capability,dimensions,distance_metric,is_active,notes,created_at,updated_at",
    )
    .eq("id", modelConfigId)
    .maybeSingle();

  if (modelError) {
    await reportModelLoadError({
      adminUserId,
      context: {
        modelConfigId,
      },
      error: modelError,
      message: "관리자 AI 모델 상세 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG,
    });

    throw new Error(`Failed to load admin AI model: ${modelError.message}`);
  }

  if (!modelRow) {
    return null;
  }

  const { data: embeddingRows, error: embeddingError } = await supabase
    .from("ai_embeddings")
    .select("model_config_id")
    .eq("model_config_id", modelConfigId);

  if (embeddingError) {
    await reportModelLoadError({
      adminUserId,
      context: {
        modelConfigId,
      },
      error: embeddingError,
      message: "관리자 AI 모델 참조 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG,
    });

    throw new Error(
      `Failed to load admin AI model references: ${embeddingError.message}`,
    );
  }

  const embeddingReferenceCount = z
    .array(aiEmbeddingReferenceRowSchema)
    .parse(embeddingRows ?? []).length;

  return mapModelRow(
    aiModelConfigRowSchema.parse(modelRow),
    embeddingReferenceCount,
  );
}

/**
 * @description 지정한 capability를 지원하는 활성 AI 모델 설정을 조회합니다.
 * @param capability 조회할 AI 모델 capability입니다.
 * @returns 표시 이름순으로 정렬된 AI 모델 설정 목록을 반환합니다.
 */
export async function getAdminAiModelOptions(
  capability: AiModelCapability,
): Promise<AdminAiModelConfigOption[]> {
  const adminUserId = await requireAdmin();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_model_configs")
    .select("capability, display_name, id, is_active, model, provider")
    .eq("capability", capability)
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) {
    await reportModelLoadError({
      adminUserId,
      context: {
        capability,
      },
      error,
      message: "관리자 AI 모델 선택 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG_OPTIONS,
    });

    throw new Error(`Failed to load admin AI model options: ${error.message}`);
  }

  const rows = z.array(adminAiModelConfigOptionRowSchema).parse(data ?? []);

  return rows.map((row) => ({
    capability: row.capability,
    displayName: row.display_name,
    id: row.id,
    isActive: row.is_active,
    model: row.model,
    provider: row.provider,
  }));
}
