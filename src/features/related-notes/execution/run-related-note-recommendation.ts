import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";

import { generateRelatedNoteRecommendations } from "./generate-related-note-recommendations";
import { prepareRelatedNoteContext } from "./prepare-related-note-context";
import { verifyRelatedNoteRecommendations } from "./verify-related-note-recommendations";

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

  /** 관련 Note 추천 Verifier Agent에 사용할 Chat Runtime Configuration입니다. */
  verificationConfiguration: AiRuntimeChatConfiguration;

  /** 검색 대상 Note의 소유 사용자 ID입니다. */
  ownerUserId: string;

  /** 관련 노트 검색 결과에서 제외할 추천 대상 Note ID입니다. */
  targetNoteId: string;

  /** 벡터 검색에서 반환할 최대 Note chunk 개수입니다. */
  limit: number;

  /** 검색 결과에 허용할 최소 유사도입니다. */
  minSimilarity: number;
};

/**
 * Note의 관련 노트 추천을 실행합니다.
 *
 * Query Expansion으로 관련 노트 검색 질의를 생성하고,
 * 기존 Note RAG를 통해 Context를 구성한 뒤,
 * 검색된 Note가 있는 경우 Answer Agent를 사용하여 추천 Note를 결정합니다.
 *
 * 검색된 Note가 없으면 추천 후보가 존재하지 않으므로
 * 불필요한 Answer Agent 호출 없이 빈 추천 결과를 반환합니다.
 *
 * @param params 관련 노트 추천 실행에 필요한 입력과 Runtime 설정입니다.
 * @returns Verifier가 승인한 `{ noteId, reason }` 추천 항목입니다.
 */
export async function runRelatedNoteRecommendation({
  title,
  content,
  queryExpansionConfiguration,
  embeddingConfiguration,
  answerConfiguration,
  verificationConfiguration,
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

  /*
   * 검색된 관련 Note가 없으면 Answer Agent를 호출하지 않습니다.
   *
   * 추천 후보 자체가 없는 상태에서 LLM을 호출해도 유효한 추천을
   * 만들 수 없으므로 불필요한 Provider 호출과 비용을 방지합니다.
   *
   * 빈 추천 결과는 저장 계층에서 정상적으로 처리되며,
   * 현재 Note에 남아 있는 active AI 추천을 제거하는 의미로 사용됩니다.
   */
  if (contextResult.notes.length === 0) {
    return {
      recommendations: [],
    };
  }

  const recommendationResult = await generateRelatedNoteRecommendations({
    configuration: answerConfiguration,
    content,
    context: contextResult.context,
    notes: contextResult.notes,
    title,
  });

  /*
   * Answer Agent가 추천을 만들지 않은 경우에는 검증할 대상이 없으므로
   * Verifier 호출을 생략하고 빈 추천을 그대로 저장 단계로 전달합니다.
   */
  if (recommendationResult.recommendations.length === 0) {
    return {
      recommendations: [],
    };
  }

  const verificationResult = await verifyRelatedNoteRecommendations({
    configuration: verificationConfiguration,
    content,
    notes: contextResult.notes,
    recommendations: recommendationResult.recommendations,
    title,
  });

  return {
    recommendations: verificationResult.recommendations,
  };
}
