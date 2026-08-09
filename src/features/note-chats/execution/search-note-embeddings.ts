import { AI_EMBEDDING_DIMENSIONS } from "@/features/ai/constants/embeddings";
import { matchAiEmbeddings } from "@/features/ai/embeddings/match";
import { createAiEmbeddingWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";

import {
  NOTE_CHAT_MATCH_LIMIT,
  NOTE_CHAT_MIN_SIMILARITY,
} from "../constants/execution";

const NOTE_CHAT_EMBEDDING_INPUT_KIND = "rag_note_content";
const NOTE_CHAT_EMBEDDING_SOURCE_TYPE = "note";

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
    throw new Error(
      `Unsupported note chat embedding dimensions: ${embeddingModel.dimensions}`,
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
    inputKind: NOTE_CHAT_EMBEDDING_INPUT_KIND,
    limit: NOTE_CHAT_MATCH_LIMIT,
    minSimilarity: NOTE_CHAT_MIN_SIMILARITY,
    modelConfigId: embeddingModel.id,
    ownerUserId,
    queryEmbedding: queryEmbedding.embedding,
    sourceType: NOTE_CHAT_EMBEDDING_SOURCE_TYPE,
  });
}
