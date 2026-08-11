import { AI_EMBEDDING_DIMENSIONS } from "@/features/ai/constants/embeddings";
import { matchAiEmbeddings } from "@/features/ai/embeddings/match";
import { createAiEmbeddingWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import {
  NOTE_EMBEDDING_INPUT_KIND,
  NOTE_EMBEDDING_SOURCE_TYPE,
} from "@/features/ai/rags/note/constants/embeddings";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";

/**
 * Note RAG에서 Note Embedding을 검색하는 입력입니다.
 */
type SearchNoteEmbeddingsParams = {
  /** 검색에 사용할 Embedding Runtime Configuration입니다. */
  embeddingConfiguration: AiRuntimeEmbeddingConfiguration;

  /** 검색 대상 Note의 소유 사용자 ID입니다. */
  ownerUserId: string;

  /** Embedding으로 변환할 검색 질의입니다. */
  question: string;

  /** 검색할 최대 Embedding 개수입니다. */
  limit: number;

  /** 검색 결과에 허용할 최소 유사도입니다. */
  minSimilarity: number;
};

/**
 * 검색 질의를 Embedding으로 변환하고,
 * 현재 사용자의 Note Embedding을 검색합니다.
 *
 * Note Embedding을 새로 생성하거나 저장하지 않으며,
 * 검색에 사용할 Embedding Model과 Note Embedding의
 * model config 및 input kind가 일치하는 결과만 반환합니다.
 *
 * @param params 검색 질의, 사용자, Runtime 설정 및 검색 정책
 * @returns 유사도 순으로 검색된 Note Embedding 목록
 */
export async function searchNoteEmbeddings({
  embeddingConfiguration,
  ownerUserId,
  question,
  limit,
  minSimilarity,
}: SearchNoteEmbeddingsParams) {
  const embeddingModel = embeddingConfiguration.model;

  if (embeddingModel.dimensions !== AI_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unsupported note embedding dimensions: ${embeddingModel.dimensions}`,
    );
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
    limit,
    minSimilarity,
    modelConfigId: embeddingModel.id,
    ownerUserId,
    queryEmbedding: queryEmbedding.embedding,
    sourceType: NOTE_EMBEDDING_SOURCE_TYPE,
  });
}
