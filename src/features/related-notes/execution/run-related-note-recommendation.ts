import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";

import { generateRelatedNoteRecommendations } from "./generate-related-note-recommendations";
import { prepareRelatedNoteContext } from "./prepare-related-note-context";

type RunRelatedNoteRecommendationParams = {
  /** 추천 대상 Note의 제목입니다. */
  title: string;

  /** 추천 대상 Note의 내용입니다. */
  content: string;

  /** Query Expansion에 사용할 Chat Runtime Configuration입니다. */
  queryExpansionConfiguration: AiRuntimeChatConfiguration;

  /** 관련 Note 검색에 사용할 Embedding Runtime Configuration입니다. */
  embeddingConfiguration: AiRuntimeEmbeddingConfiguration;

  /** 관련 Note 추천 Answer Agent에 사용할 Chat Runtime Configuration입니다. */
  answerConfiguration: AiRuntimeChatConfiguration;

  /** 검색 대상 Note의 소유 사용자 ID입니다. */
  ownerUserId: string;

  /** 관련 노트 검색 결과에서 제외할 추천 대상 Note ID입니다. */
  targetNoteId: string;

  /** 검색할 최대 Note 개수입니다. */
  limit: number;

  /** 검색 결과에 허용할 최소 유사도입니다. */
  minSimilarity: number;
};

/**
 * Note의 관련 노트 추천을 실행합니다.
 *
 * Query Expansion으로 관련 노트 검색 질의를 생성하고,
 * 기존 Note RAG를 통해 Context를 구성한 뒤,
 * Answer Agent를 사용하여 추천 Note를 결정합니다.
 *
 * @param params 관련 노트 추천 실행에 필요한 입력과 Runtime 설정입니다.
 * @returns 확장 질의, 검색된 Note 및 `{ noteId, title }` 추천 항목입니다.
 */
export async function runRelatedNoteRecommendation({
  title,
  content,
  queryExpansionConfiguration,
  embeddingConfiguration,
  answerConfiguration,
  ownerUserId,
  targetNoteId,
  limit,
  minSimilarity,
}: RunRelatedNoteRecommendationParams) {
  const contextResult = await prepareRelatedNoteContext({
    content,
    embeddingConfiguration,
    limit,
    minSimilarity,
    ownerUserId,
    queryExpansionConfiguration,
    targetNoteId,
    title,
  });

  const recommendations = await generateRelatedNoteRecommendations({
    configuration: answerConfiguration,
    context: contextResult.context,
    expandedQuery: contextResult.expandedQuery,
    notes: contextResult.notes,
  });

  return {
    expandedQuery: contextResult.expandedQuery,
    notes: contextResult.notes,
    recommendations,
  };
}
