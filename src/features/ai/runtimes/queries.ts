"use server";

import "server-only";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { reportAiOperationalError } from "../utils/report-ai-operational-error";

/**
 * AI 기능 key와 role key에 해당하는 Runtime Configuration row를 조회합니다.
 *
 * Chat Runtime Configuration의 경우 연결된 Prompt Version과 Prompt Family,
 * Agent 정보를 함께 조회하여 이후 Runtime Configuration 검증에 사용할 수 있도록 합니다.
 *
 * 이 함수는 DB row를 조회하는 역할만 담당하며, 조회된 Model Config나 Prompt Version의
 * 실행 가능 여부에 대한 상세 검증은 Runtime Configuration resolution 단계에서 수행합니다.
 *
 * @param featureKey 조회할 AI 기능의 고유 key입니다.
 * @param roleKey 조회할 기능 내부 Runtime Configuration 역할 key입니다.
 * @returns 지정한 기능과 role에 해당하는 Runtime Configuration DB row입니다.
 * @throws Runtime Configuration 조회에 실패한 경우 오류를 발생시킵니다.
 * @throws 지정한 feature key와 role key에 해당하는 Runtime Configuration이 없는 경우 오류를 발생시킵니다.
 */
export async function getAiRuntimeConfigurationRow(
  featureKey: string,
  roleKey: string,
) {
  const supabase = createAdminClient();

  /*
   * ai_settings를 inner join하여 존재하지 않는 AI 기능에 연결된
   * Runtime Configuration이 반환되지 않도록 조회 범위를 제한한다.
   *
   * Chat Configuration은 Prompt Version → Prompt Family → Agent 관계도
   * 함께 가져와 이후 Runtime resolution 단계에서 연결 관계를 검증할 수 있도록 한다.
   */
  const { data, error } = await supabase
    .from("ai_setting_configurations")
    .select(
      `
        id,
        kind,
        role_key,
        model_config_id,
        prompt_version_id,
        temperature,
        ai_settings!inner (
          id,
          key
        ),
        ai_prompt_versions (
          id,
          family_id,
          ai_prompt_families (
            id,
            agent_id
          )
        )
      `,
    )
    .eq("ai_settings.key", featureKey)
    .eq("role_key", roleKey)
    .maybeSingle();

  if (error) {
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.RUNTIME_CONFIGURATION_LOAD_FAILED,
      message: "AI runtime configuration 조회에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.GET_RUNTIME_CONFIGURATION,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(
      `Failed to load AI runtime configuration: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      `AI runtime configuration not found: ${featureKey}/${roleKey}`,
    );
  }

  return data;
}
