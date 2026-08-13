"use server";

import { z } from "zod";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { reportAiOperationalError } from "../utils/report-ai-operational-error";
import { aiEmbeddingMatchRowSchema } from "./schema";
import type { AiEmbeddingMatchRow } from "./types";
import { formatAiVectorLiteral } from "./vector";

/** AI embedding 검색 RPC 호출에 필요한 Supabase Client 최소 형태입니다. */
type AiEmbeddingMatchClient = Pick<ReturnType<typeof createAdminClient>, "rpc">;

/**
 * 저장된 AI embedding 중 query embedding과 유사한 결과를 검색합니다.
 *
 * 사용자·source type·모델·input kind 범위 안에서 기존 embedding만 검색하며,
 * 누락된 embedding을 자동 생성하거나 Provider를 호출하지 않습니다.
 *
 * @param params embedding 유사도 검색에 필요한 조건입니다.
 * @param params.queryEmbedding 검색 기준이 되는 query embedding입니다.
 * @param params.ownerUserId 검색 대상 embedding 소유 사용자 ID입니다.
 * @param params.sourceType 검색할 source 종류입니다.
 * @param params.modelConfigId 검색에 사용할 embedding 모델 설정 ID입니다.
 * @param params.inputKind 검색할 embedding 입력 용도입니다.
 * @param params.limit 반환할 최대 결과 수입니다.
 * @param params.minSimilarity 결과에 요구할 최소 similarity입니다.
 * @param options 테스트 또는 호출 계층에서 주입할 Supabase Client 옵션입니다.
 * @returns similarity 순위가 적용된 embedding 검색 결과입니다.
 * @throws query vector가 유효하지 않거나 RPC 호출에 실패하거나 반환 데이터가 예상한 스키마와 일치하지 않는 경우 오류를 발생시킵니다.
 */
export async function matchAiEmbeddings(
  params: {
    queryEmbedding: readonly number[];
    ownerUserId: string;
    sourceType: string;
    modelConfigId: string;
    inputKind: string;
    limit?: number | undefined;
    minSimilarity?: number | null | undefined;
  },
  options: { supabase?: AiEmbeddingMatchClient | undefined } = {},
): Promise<AiEmbeddingMatchRow[]> {
  const supabase = options.supabase ?? createAdminClient();

  /*
   * optional RPC 인자를 명시적으로 전달하지 않으면 DB 함수에 정의된
   * 기본값을 그대로 사용할 수 있으므로 값이 지정된 경우에만 포함한다.
   */
  const rpcArgs = {
    p_input_kind: params.inputKind,
    p_model_config_id: params.modelConfigId,
    p_owner_user_id: params.ownerUserId,
    p_query_embedding: formatAiVectorLiteral(params.queryEmbedding),
    p_source_type: params.sourceType,
    ...(params.limit !== undefined ? { p_limit: params.limit } : {}),
    ...(params.minSimilarity != null
      ? { p_min_similarity: params.minSimilarity }
      : {}),
  };

  const { data, error } = await supabase.rpc("match_ai_embeddings", rpcArgs);

  if (error) {
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.VECTOR_MATCH_FAILED,
      message: "AI embedding 매칭에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.MATCH_EMBEDDINGS,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    throw new Error(`Failed to match AI embeddings: ${error.message}`);
  }

  // RPC 결과도 애플리케이션 타입으로 사용하기 전에 런타임 스키마를 통과시킨다.
  return z.array(aiEmbeddingMatchRowSchema).parse(data ?? []);
}
