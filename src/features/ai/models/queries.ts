"use server";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import type { AiModelCapability } from "../constants/models";
import { reportAiOperationalError } from "../utils/report-ai-operational-error";
import { aiModelConfigRowSchema } from "./schema";
import type { AiModelConfig } from "./types";

/** AI model config 조회에 필요한 Supabase Client 최소 형태입니다. */
type AiModelConfigClient = Pick<ReturnType<typeof createAdminClient>, "from">;

/**
 * 활성 AI Model Config를 명시적인 ID로 조회하고 실행 조건을 검증합니다.
 *
 * @param params Model Config 조회 및 실행 조건입니다.
 * @returns 검증을 통과한 활성 AI Model Config입니다.
 */
export async function getActiveAiModelConfigById(params: {
  modelConfigId: string;
  expectedCapability: AiModelCapability;
  expectedDimensions?: number | undefined;
  supabase?: AiModelConfigClient | undefined;
}): Promise<AiModelConfig> {
  const supabase = params.supabase ?? createAdminClient();

  const { data, error } = await supabase
    .from("ai_model_configs")
    .select(
      "id,display_name,provider,model,capability,dimensions,distance_metric,is_active,notes,created_at,updated_at",
    )
    .eq("id", params.modelConfigId)
    .maybeSingle();

  if (error) {
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_LOAD_FAILED,
      message: "AI model config 조회에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(`Failed to load AI model config: ${error.message}`);
  }

  if (!data) {
    throw new Error(`AI model config not found: ${params.modelConfigId}`);
  }

  const modelConfig = aiModelConfigRowSchema.parse(data);

  if (!modelConfig.is_active) {
    throw new Error(`AI model config is inactive: ${params.modelConfigId}`);
  }

  if (modelConfig.capability !== params.expectedCapability) {
    throw new Error(
      `AI model config capability mismatch: ${params.modelConfigId} expected ${params.expectedCapability}`,
    );
  }

  if (
    params.expectedDimensions !== undefined &&
    modelConfig.dimensions !== params.expectedDimensions
  ) {
    throw new Error(
      `AI model config dimensions mismatch: ${params.modelConfigId} expected ${params.expectedDimensions}`,
    );
  }

  return modelConfig;
}
