"use server";

import { createAiEmbeddingWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import { AI_EMBEDDING_DIMENSIONS } from "../constants/embeddings";
import { reportAiOperationalError } from "../utils/report-ai-operational-error";
import { getAiEmbeddingCache, insertAiEmbedding } from "./cache";
import { createAiSha256Hash } from "./hash";
import type { AiEmbeddingRow } from "./types";
import { parseAiVectorLiteral } from "./vector";

type GenerateAiEmbeddingParams = {
  /** Embedding Runtime Configuration입니다. */
  embeddingConfiguration: AiRuntimeEmbeddingConfiguration;

  /** Embedding 원본 콘텐츠 버전을 식별하는 hash입니다. */
  contentHash: string;

  /** Embedding을 생성하는 사용자의 ID입니다. */
  ownerUserId: string;

  /** Embedding 원본의 종류입니다. */
  sourceType: string;

  /** Embedding 원본의 ID입니다. */
  sourceId: string;

  /** Embedding 입력의 용도입니다. */
  inputKind: string;

  /** Provider에 실제로 전달할 입력 텍스트입니다. */
  inputText: string;

  /** 관리 화면이나 디버깅에서 사용할 입력 미리보기입니다. */
  inputPreview: string;

  /** 이번 재인덱싱에서 생성되는 embedding 세대 ID입니다. */
  generationId: string;

  /** 현재 입력이 generation 안에서 몇 번째 chunk인지 나타냅니다. */
  chunkIndex: number;

  /** 현재 generation을 구성하는 전체 chunk 개수입니다. */
  chunkCount: number;
};

/**
 * Embedding 입력을 생성하거나 기존 vector cache를 재사용하여
 * 새 generation의 chunk embedding row를 저장합니다.
 *
 * Runtime에서 확정된 Embedding Model과 입력 hash로 기존 embedding vector를
 * 조회하며, cache hit 시 Provider 호출만 생략하고 기존 row 자체는 재사용하지
 * 않습니다. 재사용한 vector도 현재 generation/chunk 정보로 새 row에 저장합니다.
 *
 * Provider API key 누락과 Embedding Model dimensions 누락은
 * Provider 호출 전에 검증하여 운영 오류로 기록합니다.
 *
 * Provider 요청 실패는 Provider 계층에서,
 * cache 조회 및 저장 실패는 cache 계층에서 각각 운영 오류를 기록하므로
 * 이 함수에서는 동일 오류를 중복 보고하지 않습니다.
 *
 * @param params Embedding 생성에 필요한 Runtime Configuration과 입력 및 chunk 정보입니다.
 * @returns 현재 generation에 새로 저장된 AI embedding row입니다.
 * @throws Embedding Model 설정이 유효하지 않거나 Provider API key 조회,
 * Provider 호출 또는 cache 조회·저장에 실패한 경우 오류를 발생시킵니다.
 */
export async function generateAiEmbedding({
  embeddingConfiguration,
  contentHash,
  ownerUserId,
  sourceType,
  sourceId,
  inputKind,
  inputText,
  inputPreview,
  generationId,
  chunkIndex,
  chunkCount,
}: GenerateAiEmbeddingParams): Promise<AiEmbeddingRow> {
  const embeddingModel = embeddingConfiguration.model;
  const inputHash = createAiSha256Hash(inputText);

  /*
   * cache 조회와 새 generation row 저장에 공통으로 사용하는 입력입니다.
   *
   * generationId/chunkIndex/chunkCount는 cache 재사용 조건이 아니라
   * 새 row가 속할 generation과 위치를 나타냅니다.
   */
  const embeddingInput = {
    chunkCount,
    chunkIndex,
    contentHash,
    generationId,
    inputHash,
    inputKind,
    inputPreview,
    inputText,
    modelConfigId: embeddingModel.id,
    ownerUserId,
    sourceId,
    sourceType,
  };

  const cachedEmbedding = await getAiEmbeddingCache(embeddingInput);

  if (cachedEmbedding) {
    /*
     * cache hit은 Provider 호출만 생략합니다.
     *
     * 기존 row는 과거 generation에 속할 수 있으므로 그대로 반환하지 않고,
     * 저장된 vector와 token count만 재사용하여 현재 generation의 새 row를 만듭니다.
     */
    return insertAiEmbedding({
      ...embeddingInput,
      embedding: parseAiVectorLiteral(cachedEmbedding.embedding),
      tokenCount: cachedEmbedding.token_count,
    });
  }

  /*
   * Embedding Provider 호출에는 출력 차원이 반드시 필요하므로,
   * Provider 요청 전에 Runtime Model 설정을 검증합니다.
   */
  if (embeddingModel.dimensions === null) {
    const error = new Error(
      `Embedding 모델의 dimensions 설정이 없습니다: ${embeddingModel.id}`,
    );

    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_DIMENSIONS_MISSING,
      message: "AI embedding 모델의 dimensions 설정이 없습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      context: {
        modelConfigId: embeddingModel.id,
        model: embeddingModel.model,
        provider: embeddingModel.provider,
      },
    });

    throw error;
  }

  /*
   * 현재 AI Foundation은 DB의 vector(1536) 계약에 맞춰
   * AI_EMBEDDING_DIMENSIONS에 정의된 dimension만 지원합니다.
   *
   * Provider를 호출한 이후 저장 단계에서 dimension 불일치가 발생하면
   * 이미 Provider 비용이 발생할 수 있으므로, Provider 호출 전에 검증합니다.
   */
  if (embeddingModel.dimensions !== AI_EMBEDDING_DIMENSIONS) {
    const error = new Error(
      `현재 지원하지 않는 Embedding dimensions입니다: ${embeddingModel.dimensions}`,
    );

    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_DIMENSIONS_UNSUPPORTED,
      message: "현재 지원하지 않는 AI embedding dimensions입니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      context: {
        modelConfigId: embeddingModel.id,
        model: embeddingModel.model,
        provider: embeddingModel.provider,
        dimensions: embeddingModel.dimensions,
        supportedDimensions: AI_EMBEDDING_DIMENSIONS,
      },
    });

    throw error;
  }

  /*
   * API key 조회는 Provider 호출 전에 수행되므로,
   * 누락 오류는 Provider 구현에서 잡을 수 없습니다.
   * Embedding 실행 책임을 가진 이 계층에서 설정 누락을 한 번만 기록합니다.
   */
  let apiKey: string;

  try {
    apiKey = getProviderApiKey(embeddingModel.provider);
  } catch (error) {
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.PROVIDER_API_KEY_MISSING,
      message: "AI Provider API key 설정이 없습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      context: {
        modelConfigId: embeddingModel.id,
        model: embeddingModel.model,
        provider: embeddingModel.provider,
      },
    });

    throw error;
  }

  /*
   * 실제 Provider 요청 실패는 createAiEmbeddingWithProvider 하위의
   * Provider 구현에서 운영 오류로 기록하므로 여기서는 다시 report하지 않습니다.
   */
  const result = await createAiEmbeddingWithProvider({
    apiKey,
    dimensions: embeddingModel.dimensions,
    input: inputText,
    model: embeddingModel.model,
    provider: embeddingModel.provider,
  });

  /*
   * 생성된 embedding의 DB 저장 실패는 cache 계층에서
   * EMBEDDING_INSERT_FAILED 운영 오류로 기록합니다.
   */
  return insertAiEmbedding({
    ...embeddingInput,
    embedding: result.embedding,
    tokenCount: result.usage.totalTokens,
  });
}
