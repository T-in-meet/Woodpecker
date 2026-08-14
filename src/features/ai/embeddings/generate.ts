"use server";

import { createAiEmbeddingWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import { AI_EMBEDDING_DIMENSIONS } from "../constants/embeddings";
import { reportAiOperationalError } from "../utils/report-ai-operational-error";
import { getAiEmbeddingCache, insertAiEmbedding } from "./cache";
import { createAiSha256Hash } from "./hash";
import type { AiEmbeddingRow, AiEmbeddingRuntimeConfiguration } from "./types";

type GenerateAiEmbeddingParams = {
  /** Embedding Runtime Configuration입니다. */
  embeddingConfiguration: AiEmbeddingRuntimeConfiguration;

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
};

/**
 * Embedding 입력을 생성하거나 기존 cache를 재사용합니다.
 *
 * Runtime에서 확정된 Embedding Model을 사용하여 cache를 조회하고,
 * cache가 없는 경우에만 Provider를 호출하여 새로운 embedding을 저장합니다.
 *
 * Provider API key 누락과 Embedding Model dimensions 누락은
 * Provider 호출 전에 검증하여 운영 오류로 기록합니다.
 *
 * Provider 요청 실패는 Provider 계층에서,
 * cache 조회 및 저장 실패는 cache 계층에서 각각 운영 오류를 기록하므로
 * 이 함수에서는 동일 오류를 중복 보고하지 않습니다.
 *
 * @param params Embedding 생성에 필요한 Runtime Configuration과 입력 정보입니다.
 * @returns 기존 또는 새로 생성된 AI embedding cache 행입니다.
 * @throws Embedding Model 설정이 유효하지 않거나 Provider API key 조회,
 * Provider 호출 또는 cache 조회·저장에 실패한 경우 오류를 발생시킵니다.
 */
export async function generateAiEmbedding({
  embeddingConfiguration,
  ownerUserId,
  sourceType,
  sourceId,
  inputKind,
  inputText,
  inputPreview,
}: GenerateAiEmbeddingParams): Promise<AiEmbeddingRow> {
  const embeddingModel = embeddingConfiguration.model;
  const inputHash = createAiSha256Hash(inputText);
  const contentHash = inputHash;

  /*
   * 동일한 사용자·소스·모델·입력 용도·콘텐츠에 대해
   * 기존 embedding을 재사용할 수 있도록 cache key를 구성합니다.
   */
  const cacheInput = {
    contentHash,
    inputHash,
    inputKind,
    inputPreview,
    inputText,
    modelConfigId: embeddingModel.id,
    ownerUserId,
    sourceId,
    sourceType,
  };

  const cachedEmbedding = await getAiEmbeddingCache(cacheInput);

  if (cachedEmbedding) {
    return cachedEmbedding;
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
    ...cacheInput,
    embedding: result.embedding,
    tokenCount: result.usage.totalTokens,
  });
}
