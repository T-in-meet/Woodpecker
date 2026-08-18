import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { reportAiOperationalError } from "../utils/report-ai-operational-error";

/**
 * 완성된 AI embedding generation을 현재 활성 generation으로 전환합니다.
 *
 * DB의 `activate_ai_embedding_generation` RPC가 대상 generation의
 * chunk_count와 chunk_index 연속성을 검증하고, 검증에 성공한 경우에만
 * 활성 model/generation 포인터를 변경합니다.
 *
 * Note source의 경우 embedding 작업 시작 시점의 `sourceUpdatedAt`과
 * 현재 Note의 updated_at도 비교하여, 오래된 Note 내용으로 생성된 generation이
 * 최신 generation을 뒤늦게 덮어쓰는 것을 방지합니다.
 *
 * 활성화 성공 후 이전 활성 generation의 embedding row 정리도
 * 동일 RPC의 transaction 안에서 수행됩니다.
 *
 * @param input 활성화할 embedding generation의 scope와 source version입니다.
 * @throws generation이 불완전하거나 source version이 오래되었거나 RPC 호출에 실패한 경우 오류를 발생시킵니다.
 */
export async function activateAiEmbeddingGeneration(input: {
  ownerUserId: string;
  sourceType: string;
  sourceId: string;
  modelConfigId: string;
  inputKind: string;
  generationId: string;
  sourceUpdatedAt: string;
}): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.rpc("activate_ai_embedding_generation", {
    p_generation_id: input.generationId,
    p_input_kind: input.inputKind,
    p_model_config_id: input.modelConfigId,
    p_owner_user_id: input.ownerUserId,
    p_source_id: input.sourceId,
    p_source_type: input.sourceType,
    p_source_updated_at: input.sourceUpdatedAt,
  });

  if (error) {
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_ACTIVATION_FAILED,
      message: "AI embedding generation 활성화에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.ACTIVATE_EMBEDDING_GENERATION,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      context: {
        generationId: input.generationId,
        inputKind: input.inputKind,
        modelConfigId: input.modelConfigId,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        sourceUpdatedAt: input.sourceUpdatedAt,
      },
    });

    throw new Error(
      `Failed to activate AI embedding generation: ${error.message}`,
    );
  }
}
