import { z } from "zod";

import { aiPromptAgentRowSchema } from "@/features/ai/prompts/schema";
import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";

import { aiPromptFamilyRowSchema, aiPromptVersionRowSchema } from "../schema";
import type {
  AdminAiAgentRow,
  AdminAiPromptFamilyRow,
  AdminAiPromptVersionRow,
  AiPromptGraph,
} from "../types";
import { reportAdminAiLoadError } from "./report-load-error";

/**
 * DB row를 관리자 AI prompt version 행으로 변환합니다.
 *
 * @param row prompt version DB row
 * @returns 관리자 prompt version 행
 */
export function mapVersionRow(
  row: z.infer<typeof aiPromptVersionRowSchema>,
): AdminAiPromptVersionRow {
  return {
    changeSummary: row.change_summary,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByKind: row.created_by_kind,
    displayName: row.display_name,
    familyId: row.family_id,
    id: row.id,
    lifecycleStatus: row.lifecycle_status,
    responseSchema: row.response_schema as Json,
    systemTemplate: row.system_template,
    tags: row.tags,
    userTemplate: row.user_template,
    variables: row.variables as Json,
    versionNumber: row.version_number,
  };
}

/**
 * 지정된 family의 version 상태 개수를 계산합니다.
 *
 * @param versions family에 속한 prompt version 목록
 * @returns lifecycle status별 개수
 */
function countVersionStatuses(versions: AdminAiPromptVersionRow[]) {
  return {
    archivedVersionCount: versions.filter(
      (version) => version.lifecycleStatus === "archived",
    ).length,
    draftVersionCount: versions.filter(
      (version) => version.lifecycleStatus === "draft",
    ).length,
    publishedVersionCount: versions.filter(
      (version) => version.lifecycleStatus === "published",
    ).length,
  };
}

/**
 * 관리자 AI prompt family 행을 생성합니다.
 *
 * @param row prompt family DB row
 * @param agentDisplayName family가 연결된 agent 표시 이름
 * @param versions family에 속한 version 목록
 * @returns 관리자 prompt family 행
 */
export function mapFamilyRow(
  row: z.infer<typeof aiPromptFamilyRowSchema>,
  agentDisplayName: string,
  versions: AdminAiPromptVersionRow[],
): AdminAiPromptFamilyRow {
  const versionCounts = countVersionStatuses(versions);

  return {
    agentDisplayName,
    agentId: row.agent_id,
    archivedVersionCount: versionCounts.archivedVersionCount,
    createdAt: row.created_at,
    description: row.description,
    displayName: row.display_name,
    draftVersionCount: versionCounts.draftVersionCount,
    id: row.id,
    publishedVersionCount: versionCounts.publishedVersionCount,
    tags: row.tags,
    updatedAt: row.updated_at,
  };
}

/**
 * 관리자 AI agent 행을 생성합니다.
 *
 * @param row prompt agent DB row
 * @param families agent에 속한 family 목록
 * @param versionsByFamilyId family별 version 목록
 * @returns 관리자 agent 행
 */
export function mapAgentRow(
  row: z.infer<typeof aiPromptAgentRowSchema>,
  families: AdminAiPromptFamilyRow[],
  versionsByFamilyId: Map<string, AdminAiPromptVersionRow[]>,
): AdminAiAgentRow {
  const versionCount = families.reduce(
    (count, family) => count + (versionsByFamilyId.get(family.id)?.length ?? 0),
    0,
  );

  return {
    createdAt: row.created_at,
    description: row.description,
    displayName: row.display_name,
    familyCount: families.length,
    id: row.id,
    purpose: row.purpose,
    tags: row.tags,
    updatedAt: row.updated_at,
    versionCount,
  };
}

/**
 * 관리자 AI prompt graph 검증 실패를 운영 오류로 보고합니다.
 *
 * @param input Prompt Graph 검증 실패 정보
 */
async function reportPromptGraphValidationError(input: {
  adminUserId: string;
  context?: Record<string, Json>;
  error: unknown;
  message: string;
}) {
  await reportAdminAiLoadError({
    adminUserId: input.adminUserId,
    ...(input.context !== undefined ? { context: input.context } : {}),
    error: input.error,
    errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_GRAPH_INVALID,
    message: input.message,
    operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_PROMPT_GRAPH,
    stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
  });
}

/**
 * 관리자 AI prompt agent/family/version 그래프를 로드합니다.
 *
 * @param adminUserId 관리자 사용자 ID
 * @returns agent, family, version 목록
 */
export async function loadAdminAiPromptGraph(
  adminUserId: string,
): Promise<AiPromptGraph> {
  const supabase = createAdminClient();

  const [agentResult, familyResult, versionResult] = await Promise.all([
    supabase
      .from("ai_prompt_agents")
      .select("id,display_name,description,purpose,tags,created_at,updated_at"),
    supabase
      .from("ai_prompt_families")
      .select(
        "id,agent_id,display_name,description,tags,created_at,updated_at",
      ),
    supabase
      .from("ai_prompt_versions")
      .select(
        "id,family_id,version_number,display_name,change_summary,lifecycle_status,system_template,user_template,response_schema,variables,tags,created_by_kind,created_by,created_at",
      ),
  ]);

  const { data: agentRows, error: agentError } = agentResult;

  if (agentError) {
    await reportAdminAiLoadError({
      adminUserId,
      error: agentError,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_LOAD_FAILED,
      message: "관리자 AI agent 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_AGENT,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(`Failed to load admin AI agents: ${agentError.message}`);
  }

  const { data: familyRows, error: familyError } = familyResult;

  if (familyError) {
    await reportAdminAiLoadError({
      adminUserId,
      error: familyError,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_FAMILY_LOAD_FAILED,
      message: "관리자 AI prompt family 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_FAMILY,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(
      `Failed to load admin AI prompt families: ${familyError.message}`,
    );
  }

  const { data: versionRows, error: versionError } = versionResult;

  if (versionError) {
    await reportAdminAiLoadError({
      adminUserId,
      error: versionError,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_VERSION_LOAD_FAILED,
      message: "관리자 AI prompt version 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_VERSION,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(
      `Failed to load admin AI prompt versions: ${versionError.message}`,
    );
  }

  let parsedAgentRows: z.infer<typeof aiPromptAgentRowSchema>[];

  try {
    parsedAgentRows = z.array(aiPromptAgentRowSchema).parse(agentRows ?? []);
  } catch (error) {
    await reportPromptGraphValidationError({
      adminUserId,
      context: {
        graphPart: "agents",
      },
      error,
      message: "관리자 AI prompt graph Agent 데이터 검증에 실패했습니다.",
    });

    throw error;
  }

  let parsedFamilyRows: z.infer<typeof aiPromptFamilyRowSchema>[];

  try {
    parsedFamilyRows = z.array(aiPromptFamilyRowSchema).parse(familyRows ?? []);
  } catch (error) {
    await reportPromptGraphValidationError({
      adminUserId,
      context: {
        graphPart: "families",
      },
      error,
      message:
        "관리자 AI prompt graph Prompt Family 데이터 검증에 실패했습니다.",
    });

    throw error;
  }

  let parsedVersionRows: z.infer<typeof aiPromptVersionRowSchema>[];

  try {
    parsedVersionRows = z
      .array(aiPromptVersionRowSchema)
      .parse(versionRows ?? []);
  } catch (error) {
    await reportPromptGraphValidationError({
      adminUserId,
      context: {
        graphPart: "versions",
      },
      error,
      message:
        "관리자 AI prompt graph Prompt Version 데이터 검증에 실패했습니다.",
    });

    throw error;
  }

  const versionsByFamilyId = new Map<string, AdminAiPromptVersionRow[]>();

  // Family별 Version 배열의 첫 항목을 최신 Version으로 사용할 수 있도록
  // 전체 Version을 versionNumber 내림차순으로 정렬한 뒤 Family별로 그룹화한다.
  for (const version of parsedVersionRows
    .map(mapVersionRow)
    .sort((left, right) => right.versionNumber - left.versionNumber)) {
    const versions = versionsByFamilyId.get(version.familyId) ?? [];
    versions.push(version);
    versionsByFamilyId.set(version.familyId, versions);
  }

  const agentRowsById = new Map(
    parsedAgentRows.map((agentRow) => [agentRow.id, agentRow]),
  );

  // 기존 missing-agent fallback은 유지하되,
  // Agent-Family 관계가 깨진 상태는 운영 오류로 보고한다.
  for (const familyRow of parsedFamilyRows) {
    if (!agentRowsById.has(familyRow.agent_id)) {
      const error = new Error(
        `Failed to resolve agent for AI prompt family: ${familyRow.id}`,
      );

      await reportPromptGraphValidationError({
        adminUserId,
        context: {
          agentId: familyRow.agent_id,
          familyId: familyRow.id,
        },
        error,
        message:
          "관리자 AI prompt graph Prompt Family의 Agent 연결 검증에 실패했습니다.",
      });
    }
  }

  const families = parsedFamilyRows.map((familyRow) => {
    const agentRow = agentRowsById.get(familyRow.agent_id);
    const versions = versionsByFamilyId.get(familyRow.id) ?? [];

    return mapFamilyRow(
      familyRow,
      agentRow?.display_name ?? "(missing-agent)",
      versions,
    );
  });

  const familiesByAgentId = new Map<string, AdminAiPromptFamilyRow[]>();

  for (const family of families) {
    const agentFamilies = familiesByAgentId.get(family.agentId) ?? [];
    agentFamilies.push(family);
    familiesByAgentId.set(family.agentId, agentFamilies);
  }

  const agents = parsedAgentRows.map((agentRow) =>
    mapAgentRow(
      agentRow,
      familiesByAgentId.get(agentRow.id) ?? [],
      versionsByFamilyId,
    ),
  );

  return {
    agents,
    families,
    versionsByFamilyId,
  };
}
