import { AI_EMBEDDING_DIMENSIONS } from "@/features/ai/constants/embeddings";
import { matchAiEmbeddings } from "@/features/ai/embeddings/match";
import { createAiEmbeddingWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";
import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
  NOTE_CHAT_OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";

import {
  NOTE_EMBEDDING_INPUT_KIND,
  NOTE_EMBEDDING_SOURCE_TYPE,
} from "../constants/embeddings";
import {
  NOTE_CHAT_MATCH_LIMIT,
  NOTE_CHAT_MIN_SIMILARITY,
} from "../constants/execution";
import { reportNoteChatOperationalError } from "../utils/report-operational-error";

/**
 * 노트 챗봇의 Note Embedding 검색 입력입니다.
 */
type SearchNoteChatEmbeddingsParams = {
  /** 검색에 사용할 Embedding Runtime Configuration입니다. */
  embeddingConfiguration: AiRuntimeEmbeddingConfiguration;

  /** 검색 대상 노트의 소유 사용자 ID입니다. */
  ownerUserId: string;

  /** Embedding으로 변환할 현재 사용자 질문입니다. */
  question: string;
};

/**
 * 현재 사용자 질문과 유사한 Note Embedding을 검색합니다.
 *
 * 질문 자체는 Runtime에서 확정된 Embedding Model로 새 embedding을 생성하고,
 * 저장된 Note Embedding 중 동일한 Model Config와 input kind를 사용하는
 * 현재 사용자의 embedding만 검색합니다.
 *
 * 이 함수는 Note Embedding을 새로 생성하거나 저장하지 않습니다.
 *
 * @param params 질문, 사용자 및 Embedding Runtime Configuration
 * @returns 유사도 순으로 검색된 Note Embedding 목록
 */
export async function searchNoteChatEmbeddings({
  embeddingConfiguration,
  ownerUserId,
  question,
}: SearchNoteChatEmbeddingsParams) {
  const embeddingModel = embeddingConfiguration.model;

  if (embeddingModel.dimensions !== AI_EMBEDDING_DIMENSIONS) {
    const error = new Error(
      `Unsupported note chat embedding dimensions: ${embeddingModel.dimensions}`,
    );

    /*
     * Runtime에서 선택된 Embedding Model의 dimensions가
     * 현재 Note Chat 검색 파이프라인이 지원하는 값과 다르면
     * Provider 호출 전에 설정 오류로 실행을 중단합니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: ownerUserId,
      context: {
        embeddingModelConfigId: embeddingModel.id,
        expectedDimensions: AI_EMBEDDING_DIMENSIONS,
        receivedDimensions: embeddingModel.dimensions,
      },
      error,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.EMBEDDING_CONFIGURATION_INVALID,
      message: "노트 챗봇 Embedding 설정이 올바르지 않습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.VALIDATE_EMBEDDING_CONFIGURATION,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.CONFIGURATION,
      userId: ownerUserId,
    });

    throw error;
  }

  const queryEmbedding = await createAiEmbeddingWithProvider({
    apiKey: getProviderApiKey(embeddingModel.provider),
    dimensions: embeddingModel.dimensions,
    input: question,
    model: embeddingModel.model,
    provider: embeddingModel.provider,
  });

  return matchAiEmbeddings({
    inputKind: NOTE_EMBEDDING_INPUT_KIND,
    limit: NOTE_CHAT_MATCH_LIMIT,
    minSimilarity: NOTE_CHAT_MIN_SIMILARITY,
    modelConfigId: embeddingModel.id,
    ownerUserId,
    queryEmbedding: queryEmbedding.embedding,
    sourceType: NOTE_EMBEDDING_SOURCE_TYPE,
  });
}
