"use server";

import { createAiEmbeddingWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

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
 * @param params Embedding 생성에 필요한 Runtime Configuration과 입력 정보입니다.
 * @returns 기존 또는 새로 생성된 AI embedding cache 행입니다.
 * @throws Embedding Model의 설정이 유효하지 않거나 Provider 호출 또는 cache 저장에 실패한 경우 오류를 발생시킵니다.
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

  const result = await createAiEmbeddingWithProvider({
    apiKey: getProviderApiKey(embeddingModel.provider),
    dimensions: embeddingModel.dimensions,
    input: inputText,
    model: embeddingModel.model,
    provider: embeddingModel.provider,
  });

  return insertAiEmbedding({
    ...cacheInput,
    embedding: result.embedding,
    tokenCount: result.usage.totalTokens,
  });
}
