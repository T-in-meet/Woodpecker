"use server";

import { z } from "zod";

import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
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
} from "../utils/list-rpc";
import { reportAdminAiLoadError } from "../utils/report-load-error";
import {
  getAdminAiSettingConfigurationsInternal,
  getAdminAiSettingDetailInternal,
} from "./queries.internal";
import {
  adminAiSettingListRowSchema,
  adminAiSettingListRpcResultSchema,
} from "./schema";
import type { AdminAiSettingConfiguration } from "./types";
import type {
  AdminAiSettingListItem,
  AdminAiSettingListQuery,
  AdminAiSettingListResult,
} from "./types/ai-settings-list";

/** AI 설정 Chat 구성 복원에 필요한 Prompt Version 관계 row입니다. */
const aiSettingPromptVersionRelationRowSchema = z.object({
  ai_prompt_families: z
    .object({
      agent_id: z.string().uuid(),
      ai_prompt_agents: z
        .object({
          display_name: z.string(),
          id: z.string().uuid(),
        })
        .nullable(),
      display_name: z.string(),
      id: z.string().uuid(),
    })
    .nullable(),
  family_id: z.string().uuid(),
  id: z.string().uuid(),
});

/** AI 설정 Chat 구성에서 참조하는 Prompt Version 관계입니다. */
type AiSettingPromptVersionRelation = {
  agentDisplayName: string | null;
  agentId: string;
  familyDisplayName: string;
  familyId: string;
  promptVersionId: string;
};

/**
 * Settings Chat 구성에서 참조하는 Prompt Version 관계만 scoped query로 조회합니다.
 *
 * @param params 조회 및 오류 보고에 필요한 입력값
 * @param params.adminUserId 관리자 사용자 ID
 * @param params.promptVersionIds 조회할 Prompt Version ID 목록
 * @param params.settingId 조회 중인 AI Setting ID
 * @returns Prompt Version ID별 Family/Agent 관계
 */
async function loadAiSettingPromptVersionRelations(params: {
  adminUserId: string;
  promptVersionIds: string[];
  settingId: string;
}) {
  if (params.promptVersionIds.length === 0) {
    return new Map<string, AiSettingPromptVersionRelation>();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_prompt_versions")
    .select(
      `
        id,
        family_id,
        ai_prompt_families (
          id,
          agent_id,
          display_name,
          ai_prompt_agents (
            id,
            display_name
          )
        )
      `,
    )
    .in("id", params.promptVersionIds);

  if (error) {
    await reportAdminAiLoadError({
      adminUserId: params.adminUserId,
      context: {
        promptVersionCount: params.promptVersionIds.length,
        settingId: params.settingId,
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_VERSION_LOAD_FAILED,
      message: "관리자 AI 구성의 Prompt Version 관계 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_VERSION,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(
      `Failed to load AI setting prompt version relations: ${error.message}`,
    );
  }

  const relations = new Map<string, AiSettingPromptVersionRelation>();
  const rows = z
    .array(aiSettingPromptVersionRelationRowSchema)
    .parse(data ?? []);

  for (const row of rows) {
    if (!row.ai_prompt_families) {
      continue;
    }

    relations.set(row.id, {
      agentDisplayName:
        row.ai_prompt_families.ai_prompt_agents?.display_name ?? null,
      agentId: row.ai_prompt_families.agent_id,
      familyDisplayName: row.ai_prompt_families.display_name,
      familyId: row.ai_prompt_families.id,
      promptVersionId: row.id,
    });
  }

  return relations;
}

/**
 * 관리자 AI 설정 상세를 조회합니다.
 *
 * @param settingId 조회할 ai_settings.id
 * @returns AI 설정 상세 또는 null
 */
export async function getAdminAiSettingDetail(settingId: string) {
  const adminUserId = await requireAdmin();

  try {
    return await getAdminAiSettingDetailInternal(settingId);
  } catch (error) {
    await reportAdminAiLoadError({
      adminUserId,
      context: {
        settingId,
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_LOAD_FAILED,
      message: "관리자 AI 설정 상세 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_SETTING,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw error;
  }
}

/**
 * AI 설정에 연결된 구성을 조회합니다.
 *
 * Chat 구성은 저장된 Prompt Version을 기준으로
 * Agent와 Prompt Family를 복원합니다.
 *
 * @param settingId 조회할 AI 설정 ID
 * @returns 폼에서 사용할 AI 설정 구성 목록
 */
export async function getAdminAiSettingConfigurations(
  settingId: string,
): Promise<AdminAiSettingConfiguration[]> {
  const adminUserId = await requireAdmin();

  let rows: Awaited<ReturnType<typeof getAdminAiSettingConfigurationsInternal>>;

  try {
    rows = await getAdminAiSettingConfigurationsInternal(settingId);
  } catch (error) {
    await reportAdminAiLoadError({
      adminUserId,
      context: {
        settingId,
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_LOAD_FAILED,
      message: "관리자 AI 구성 조회에 실패했습니다.",
      operation:
        ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_SETTING_CONFIGURATIONS,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw error;
  }

  const promptVersionIds = [
    ...new Set(
      rows.flatMap((row) =>
        row.kind === "chat" && row.prompt_version_id !== null
          ? [row.prompt_version_id]
          : [],
      ),
    ),
  ];

  const promptVersionRelations = await loadAiSettingPromptVersionRelations({
    adminUserId,
    promptVersionIds,
    settingId,
  });

  const configurations: AdminAiSettingConfiguration[] = [];

  for (const row of rows) {
    if (row.kind === "embedding") {
      configurations.push({
        id: row.id,
        kind: "embedding",
        roleKey: row.role_key,
        modelConfigId: row.model_config_id,
      });

      continue;
    }

    if (row.prompt_version_id === null || row.temperature === null) {
      const error = new Error(
        `Invalid chat AI setting configuration: ${row.id}`,
      );

      await reportAdminAiLoadError({
        adminUserId,
        context: {
          configurationId: row.id,
          settingId,
        },
        error,
        errorCode:
          ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_CONFIGURATION_INVALID,
        message: "관리자 AI chat 구성 데이터가 올바르지 않습니다.",
        operation:
          ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_SETTING_CONFIGURATION,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      });

      throw error;
    }

    const promptVersionRelation = promptVersionRelations.get(
      row.prompt_version_id,
    );

    if (!promptVersionRelation) {
      const error = new Error(
        `Failed to resolve prompt family for AI setting configuration: ${row.id}`,
      );

      await reportAdminAiLoadError({
        adminUserId,
        context: {
          configurationId: row.id,
          promptVersionId: row.prompt_version_id,
          settingId,
        },
        error,
        errorCode:
          ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_CONFIGURATION_INVALID,
        message: "관리자 AI 구성의 Prompt Family 확인에 실패했습니다.",
        operation:
          ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_SETTING_CONFIGURATION,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      });

      throw error;
    }

    configurations.push({
      id: row.id,
      kind: "chat",
      roleKey: row.role_key,
      agentId: promptVersionRelation.agentId,
      promptFamilyId: promptVersionRelation.familyId,
      promptVersionId: row.prompt_version_id,
      modelConfigId: row.model_config_id,
      temperature: row.temperature,
    });
  }

  return configurations;
}

/**
 * 관리자 AI 설정 목록 RPC에 전달할 파라미터를 생성합니다.
 *
 * @param query 목록 검색, 필터, 정렬, 페이지네이션 조건
 * @returns Supabase RPC 파라미터
 */
function createAdminAiSettingListRpcArgs(query: AdminAiSettingListQuery) {
  return {
    p_chat_count_max: getNumberRangeRpcMax(
      query.filters.chatConfigurationCount,
    ),
    p_chat_count_min: getNumberRangeRpcMin(
      query.filters.chatConfigurationCount,
    ),
    p_chat_model_id_filters: getMultiSelectRpcValues(query.filters.chatModel),
    p_created_from: getDateRangeRpcFrom(query.filters.createdAt),
    p_created_to: getDateRangeRpcTo(query.filters.createdAt),
    p_embedding_count_max: getNumberRangeRpcMax(
      query.filters.embeddingConfigurationCount,
    ),
    p_embedding_count_min: getNumberRangeRpcMin(
      query.filters.embeddingConfigurationCount,
    ),
    p_embedding_model_id_filters: getMultiSelectRpcValues(
      query.filters.embeddingModel,
    ),
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
 * AI 설정 목록 RPC row를 화면 표시 모델로 변환합니다.
 *
 * @param row AI 설정 목록 RPC row
 * @returns 관리자 AI 설정 목록 항목
 */
function mapAdminAiSettingListRow(
  row: z.infer<typeof adminAiSettingListRowSchema>,
): AdminAiSettingListItem {
  return {
    agents: row.agents,
    chatConfigurationCount: row.chatConfigurationCount,
    chatModels: row.chatModels,
    createdAt: row.createdAt,
    displayName: row.displayName,
    embeddingConfigurationCount: row.embeddingConfigurationCount,
    embeddingModels: row.embeddingModels,
    id: row.id,
    key: row.key,
    updatedAt: row.updatedAt,
  };
}

type GetAdminAiSettingListRpcArgs =
  Database["public"]["Functions"]["get_admin_ai_setting_list"]["Args"];

/**
 * 관리자 AI 설정 목록 응답 검증 실패를 운영 오류로 보고합니다.
 *
 * @param input 목록 응답 검증 실패 정보
 */
async function reportSettingListResponseValidationError(input: {
  adminUserId: string;
  error: unknown;
  page: number;
  pageSize: number;
  query: AdminAiSettingListQuery;
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
    message: "관리자 AI 설정 목록 응답 검증에 실패했습니다.",
    operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
    stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
  });
}

/**
 * 관리자 AI 설정 목록을 조회합니다.
 *
 * @param query 목록 검색, 필터, 정렬, 페이지네이션 조건
 * @returns 관리자 AI 설정 목록 결과
 */
export async function getAdminAiSettings(
  query: AdminAiSettingListQuery,
): Promise<AdminAiSettingListResult> {
  const adminUserId = await requireAdmin();

  const supabase = createAdminClient();
  const page = Math.max(1, query.page);
  const pageSize = query.pageSize;

  const rpcArgs = createAdminAiSettingListRpcArgs({
    ...query,
    page,
  });

  const { data, error } = await supabase.rpc(
    "get_admin_ai_setting_list",
    rpcArgs as GetAdminAiSettingListRpcArgs,
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
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_LOAD_FAILED,
      message: "관리자 AI 설정 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_SETTINGS,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(`Failed to load admin AI settings: ${error.message}`);
  }

  let rpcResults: z.infer<typeof adminAiSettingListRpcResultSchema>[];

  try {
    rpcResults = z
      .array(adminAiSettingListRpcResultSchema)
      .length(1)
      .parse(data ?? []);
  } catch (error) {
    await reportSettingListResponseValidationError({
      adminUserId,
      error,
      page,
      pageSize,
      query,
    });

    throw error;
  }

  // RPC 계약과 length(1) 검증으로 최상위 결과가 정확히 1개임이 보장된다.
  const rpcResult = rpcResults[0]!;

  let items: AdminAiSettingListItem[];

  try {
    items = z
      .array(adminAiSettingListRowSchema)
      .parse(rpcResult.items)
      .map(mapAdminAiSettingListRow);
  } catch (error) {
    await reportSettingListResponseValidationError({
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
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
