"use server";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { reportAiOperationalError } from "../utils/report-ai-operational-error";
import { aiEmbeddingRowSchema } from "./schema";
import type { AiEmbeddingInput, AiEmbeddingRow } from "./types";
import { formatAiVectorLiteral } from "./vector";

/** AI embedding cache 조회와 삽입에 필요한 Supabase Client 최소 형태입니다. */
type AiEmbeddingClient = Pick<ReturnType<typeof createAdminClient>, "from">;

/** AI embedding generation cleanup RPC 호출에 필요한 Supabase Client 최소 형태입니다. */
type AiEmbeddingGenerationCleanupClient = Pick<
  ReturnType<typeof createAdminClient>,
  "rpc"
>;

/**
 * Provider 호출 없이 기존 embedding vector를 재사용하기 위해 필요한 cache key입니다.
 *
 * vector는 Provider에 실제 전달된 input과 Model이 같으면 동일하게 재사용할 수 있으므로
 * 원본 콘텐츠 버전을 나타내는 contentHash와 source/generation/chunk 위치는
 * cache 재사용 조건에 포함하지 않습니다.
 */
type AiEmbeddingCacheLookupInput = Pick<
  AiEmbeddingInput,
  "inputHash" | "inputKind" | "modelConfigId" | "ownerUserId"
>;

const AI_EMBEDDING_COLUMNS =
  "id,owner_user_id,source_type,source_id,model_config_id,input_kind,content_hash,input_hash,input_text,input_preview,embedding,token_count,chunk_index,chunk_count,generation_id,created_at";

/**
 * 동일한 입력으로 이미 생성된 AI embedding을 조회합니다.
 *
 * Provider 호출이나 새로운 embedding row 생성은 수행하지 않으며,
 * 동일 사용자·모델·입력 용도·콘텐츠에 대해 기존에 생성된 embedding vector를
 * 재사용할 수 있는 cache row만 반환합니다.
 *
 * 동일 cache key를 가진 row가 여러 generation/source에 존재할 수 있으므로
 * 가장 최근에 생성된 row 하나만 사용합니다.
 *
 * @param input embedding cache 조회에 사용할 키입니다.
 * @param options 테스트 또는 호출 계층에서 주입할 Supabase Client 옵션입니다.
 * @returns 재사용 가능한 embedding cache 행이며, 존재하지 않으면 `null`입니다.
 * @throws cache 조회에 실패하거나 조회 결과가 예상한 스키마와 일치하지 않는 경우 오류를 발생시킵니다.
 */
export async function getAiEmbeddingCache(
  input: AiEmbeddingCacheLookupInput,
  options: { supabase?: AiEmbeddingClient | undefined } = {},
): Promise<AiEmbeddingRow | null> {
  const supabase = options.supabase ?? createAdminClient();

  /*
   * sourceId/generationId/chunkIndex와 원본 contentHash는
   * embedding vector 자체의 생성 조건이 아닙니다.
   *
   * 동일 사용자·모델·입력 용도·실제 Provider input이라면 기존 vector를
   * 재사용할 수 있으며, 새 generation에는 호출 계층이 현재 contentHash와
   * generation/chunk 정보를 사용해 별도 row를 삽입합니다.
   */
  const { data, error } = await supabase
    .from("ai_embeddings")
    .select(AI_EMBEDDING_COLUMNS)
    .eq("owner_user_id", input.ownerUserId)
    .eq("model_config_id", input.modelConfigId)
    .eq("input_kind", input.inputKind)
    .eq("input_hash", input.inputHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_CACHE_READ_FAILED,
      message: "AI embedding cache 조회에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.GET_EMBEDDING_CACHE,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(`Failed to read AI embedding cache: ${error.message}`);
  }

  // DB 반환값을 그대로 노출하지 않고 공통 embedding 행 스키마에서 검증한다.
  return data ? aiEmbeddingRowSchema.parse(data) : null;
}

/**
 * 생성되거나 재사용된 AI embedding을 새 generation의 chunk row로 저장합니다.
 *
 * 이 함수는 Provider 호출을 수행하지 않으며, 호출자가 준비한 embedding vector와
 * generation/chunk 정보 및 입력 snapshot을 하나의 row로 영속화합니다.
 *
 * @param input 저장할 embedding과 generation/chunk 및 입력 snapshot 정보입니다.
 * @param options 테스트 또는 호출 계층에서 주입할 Supabase Client 옵션입니다.
 * @returns 저장 후 DB에서 반환된 AI embedding row입니다.
 * @throws embedding 벡터가 저장 가능한 형식이 아니거나 DB 삽입에 실패하거나 반환 행이 예상한 스키마와 일치하지 않는 경우 오류를 발생시킵니다.
 */
export async function insertAiEmbedding(
  input: AiEmbeddingInput & {
    embedding: readonly number[];
    tokenCount?: number | null | undefined;
  },
  options: { supabase?: AiEmbeddingClient | undefined } = {},
): Promise<AiEmbeddingRow> {
  const supabase = options.supabase ?? createAdminClient();

  /*
   * pgvector 컬럼에는 number[]를 직접 전달하지 않고 공통 formatter를 사용해
   * dimension 및 값 유효성을 검증한 vector literal만 저장한다.
   */
  const { data, error } = await supabase
    .from("ai_embeddings")
    .insert({
      chunk_count: input.chunkCount,
      chunk_index: input.chunkIndex,
      content_hash: input.contentHash,
      embedding: formatAiVectorLiteral(input.embedding),
      generation_id: input.generationId,
      input_hash: input.inputHash,
      input_kind: input.inputKind,
      input_preview: input.inputPreview,
      input_text: input.inputText,
      model_config_id: input.modelConfigId,
      owner_user_id: input.ownerUserId,
      source_id: input.sourceId,
      source_type: input.sourceType,
      token_count: input.tokenCount ?? null,
    })
    .select(AI_EMBEDDING_COLUMNS)
    .single();

  if (error) {
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_INSERT_FAILED,
      message: "AI embedding 저장에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.INSERT_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(`Failed to insert AI embedding: ${error.message}`);
  }

  return aiEmbeddingRowSchema.parse(data);
}

/**
 * 현재 active가 아닌 AI embedding generation만 안전하게 삭제합니다.
 *
 * generation 생성 또는 활성화 과정에서 실패한 새 generation을 정리할 때 사용합니다.
 *
 * 활성화 RPC가 DB에서는 성공했지만 호출 계층에는 실패로 전달되는 모호한 상황에서도
 * DB의 delete_inactive_ai_embedding_generation RPC가 현재 active pointer를 확인하므로,
 * 이미 활성화된 generation의 chunk가 삭제되는 것을 방지합니다.
 *
 * @param input 정리할 embedding generation의 scope입니다.
 * @param options 테스트 또는 호출 계층에서 주입할 Supabase Client 옵션입니다.
 * @returns 삭제된 generation chunk 행의 개수입니다.
 * @throws inactive generation cleanup RPC 호출에 실패한 경우 오류를 발생시킵니다.
 */
export async function deleteInactiveAiEmbeddingGeneration(
  input: {
    ownerUserId: string;
    sourceType: string;
    sourceId: string;
    modelConfigId: string;
    inputKind: string;
    generationId: string;
  },
  options: {
    supabase?: AiEmbeddingGenerationCleanupClient | undefined;
  } = {},
): Promise<number> {
  const supabase = options.supabase ?? createAdminClient();

  /*
   * active 여부를 애플리케이션에서 조회한 뒤 DELETE하지 않습니다.
   * 조회와 삭제 사이의 race를 피하기 위해 DB RPC 안에서
   * advisory lock과 active generation 확인을 함께 수행합니다.
   */
  const { data, error } = await supabase.rpc(
    "delete_inactive_ai_embedding_generation",
    {
      p_generation_id: input.generationId,
      p_input_kind: input.inputKind,
      p_model_config_id: input.modelConfigId,
      p_owner_user_id: input.ownerUserId,
      p_source_id: input.sourceId,
      p_source_type: input.sourceType,
    },
  );

  if (error) {
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_DELETE_FAILED,
      message: "AI embedding generation 정리에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.DELETE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      context: {
        generationId: input.generationId,
        inputKind: input.inputKind,
        modelConfigId: input.modelConfigId,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
      },
    });

    throw new Error(
      `Failed to delete inactive AI embedding generation: ${error.message}`,
    );
  }

  return data ?? 0;
}
