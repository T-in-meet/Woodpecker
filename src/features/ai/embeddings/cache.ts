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

const AI_EMBEDDING_COLUMNS =
  "id,owner_user_id,source_type,source_id,model_config_id,input_kind,content_hash,input_hash,input_text,input_preview,embedding,token_count,created_at";

/**
 * 전체 캐시 키와 일치하는 기존 AI embedding을 조회합니다.
 *
 * Provider 호출이나 새로운 embedding 생성은 수행하지 않으며,
 * 동일 사용자·소스·모델·입력 용도·콘텐츠에 대해 이미 저장된 결과만 반환합니다.
 *
 * @param input embedding 캐시 조회에 사용할 키와 입력 정보입니다.
 * @param options 테스트 또는 호출 계층에서 주입할 Supabase Client 옵션입니다.
 * @returns 일치하는 embedding cache 행이며, 존재하지 않으면 `null`입니다.
 * @throws 캐시 조회에 실패하거나 조회 결과가 예상한 스키마와 일치하지 않는 경우 오류를 발생시킵니다.
 */
export async function getAiEmbeddingCache(
  input: AiEmbeddingInput,
  options: { supabase?: AiEmbeddingClient | undefined } = {},
): Promise<AiEmbeddingRow | null> {
  const supabase = options.supabase ?? createAdminClient();

  /*
   * 사용자와 source만으로 캐시를 재사용하지 않는다.
   * 모델·입력 용도·콘텐츠가 모두 동일해야 같은 embedding으로 취급한다.
   */
  const { data, error } = await supabase
    .from("ai_embeddings")
    .select(AI_EMBEDDING_COLUMNS)
    .eq("owner_user_id", input.ownerUserId)
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .eq("model_config_id", input.modelConfigId)
    .eq("input_kind", input.inputKind)
    .eq("content_hash", input.contentHash)
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
 * 생성된 AI embedding을 캐시 테이블에 저장합니다.
 *
 * 이 함수는 Provider 호출을 수행하지 않으며, 호출자가 이미 생성한 embedding과
 * 입력 snapshot 및 hash 정보를 하나의 캐시 행으로 영속화하는 역할만 담당합니다.
 *
 * @param input 저장할 embedding과 캐시 키 및 입력 snapshot 정보입니다.
 * @param options 테스트 또는 호출 계층에서 주입할 Supabase Client 옵션입니다.
 * @returns 저장 후 DB에서 반환된 AI embedding cache 행입니다.
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
      content_hash: input.contentHash,
      embedding: formatAiVectorLiteral(input.embedding),
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
 * 특정 source에 연결된 기존 AI embedding cache를 삭제합니다.
 *
 * 새 embedding으로 교체하는 과정에서 이전 embedding이 검색 결과에
 * 남지 않도록 source와 input kind가 일치하는 기존 cache를 정리합니다.
 *
 * @param input 삭제할 embedding의 source 정보와 유지할 embedding ID입니다.
 * @param options 테스트 또는 호출 계층에서 주입할 Supabase Client 옵션입니다.
 * @returns 삭제된 embedding 행의 개수입니다.
 * @throws AI embedding cache 삭제에 실패한 경우 오류를 발생시킵니다.
 */
export async function deleteAiEmbeddingsBySource(
  input: {
    ownerUserId: string;
    sourceType: string;
    sourceId: string;
    inputKind: string;
    excludeEmbeddingId?: string | undefined;
  },
  options: { supabase?: AiEmbeddingClient | undefined } = {},
): Promise<number> {
  const supabase = options.supabase ?? createAdminClient();

  let query = supabase
    .from("ai_embeddings")
    .delete({ count: "exact" })
    .eq("owner_user_id", input.ownerUserId)
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .eq("input_kind", input.inputKind);

  if (input.excludeEmbeddingId) {
    query = query.neq("id", input.excludeEmbeddingId);
  }

  const { error, count } = await query;

  if (error) {
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_DELETE_FAILED,
      message: "AI embedding 삭제에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.DELETE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(`Failed to delete AI embeddings: ${error.message}`);
  }

  return count ?? 0;
}
