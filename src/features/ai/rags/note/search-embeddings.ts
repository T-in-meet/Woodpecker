import { AI_EMBEDDING_DIMENSIONS } from "@/features/ai/constants/embeddings";
import { matchAiEmbeddings } from "@/features/ai/embeddings/match";
import type { AiEmbeddingMatchRow } from "@/features/ai/embeddings/types";
import { createAiEmbeddingWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import {
  NOTE_EMBEDDING_INPUT_KIND,
  NOTE_EMBEDDING_SOURCE_TYPE,
} from "@/features/ai/rags/note/constants/embeddings";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";

/**
 * Note RAG에서 Note chunk Embedding을 검색하는 입력입니다.
 */
type SearchNoteEmbeddingsParams = {
  /** 검색에 사용할 Embedding Runtime Configuration입니다. */
  embeddingConfiguration: AiRuntimeEmbeddingConfiguration;

  /** 검색 대상 Note의 소유 사용자 ID입니다. */
  ownerUserId: string;

  /** Embedding으로 변환할 검색 질의입니다. */
  question: string;

  /**
   * 검색할 최대 chunk 개수입니다.
   *
   * 청킹 도입 이후 match_ai_embeddings는 Note 단위가 아니라
   * 활성 generation에 속한 chunk 단위 Top-K를 반환합니다.
   */
  limit: number;

  /** 검색 결과에 허용할 최소 유사도입니다. */
  minSimilarity: number;
};

/**
 * 검색 질의를 Embedding으로 변환하고,
 * 현재 사용자의 활성 Note chunk Embedding을 검색합니다.
 *
 * Note Embedding을 새로 생성하거나 저장하지 않으며,
 * 현재 Runtime에서 선택된 Embedding Model과 동일한 모델로 생성된
 * 활성 generation의 chunk만 검색합니다.
 *
 * 반환 결과는 Note 단위로 중복 제거하지 않습니다.
 * 따라서 하나의 Note에서 여러 관련 chunk가 검색될 수 있으며,
 * Note 단위 집계가 필요한 기능은 호출 계층에서 별도로 처리해야 합니다.
 *
 * @param params 검색 질의, 사용자, Runtime 설정 및 검색 정책
 * @returns 유사도 순으로 검색된 활성 Note chunk Embedding 목록
 */
export async function searchNoteEmbeddings({
  embeddingConfiguration,
  ownerUserId,
  question,
  limit,
  minSimilarity,
}: SearchNoteEmbeddingsParams): Promise<AiEmbeddingMatchRow[]> {
  const embeddingModel = embeddingConfiguration.model;

  /*
   * 현재 AI Foundation의 pgvector 저장 계약은 1536 dimensions로 고정되어 있으므로
   * 다른 차원의 Embedding Model은 Provider 호출 전에 거부합니다.
   */
  if (embeddingModel.dimensions !== AI_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unsupported note embedding dimensions: ${embeddingModel.dimensions}`,
    );
  }

  /*
   * 검색 질의 자체는 저장하지 않고 동일 Embedding Model로 vector만 생성합니다.
   * 저장된 Note chunk vector와 같은 vector space에서 비교하기 위한 과정입니다.
   */
  const queryEmbedding = await createAiEmbeddingWithProvider({
    apiKey: getProviderApiKey(embeddingModel.provider),
    dimensions: embeddingModel.dimensions,
    input: question,
    model: embeddingModel.model,
    provider: embeddingModel.provider,
  });

  /*
   * matchAiEmbeddings는 현재 활성 generation의 chunk만 대상으로
   * 거리순 Top-K를 반환합니다.
   */
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
