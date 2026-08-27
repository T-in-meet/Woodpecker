import type { AiTokenUsage } from "@/features/ai/providers/types";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";

import { generateRelatedNoteRecommendations } from "./generate-related-note-recommendations";
import { prepareRelatedNoteContext } from "./prepare-related-note-context";
import {
  type RelatedNoteVerification,
  verifyRelatedNoteRecommendations,
} from "./verify-related-note-recommendations";

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

  /** Query Expansion Provider usage 저장 callback입니다. */
  onQueryExpansionUsage?: (usage: AiTokenUsage) => Promise<void>;

  /** 파싱과 검증을 통과한 Query Expansion 검색 질의 저장 callback입니다. */
  onExpandedQuery?: (expandedQuery: string) => Promise<void>;

  /** Query embedding usage 저장 callback입니다. */
  onQueryEmbeddingUsage?: (usage: AiTokenUsage) => Promise<void>;

  /** 검색된 Note ID snapshot 저장 callback입니다. */
  onMatchedNotes?: (noteIds: string[]) => Promise<void>;

  /** Answer Generation usage 저장 callback입니다. */
  onAnswerGenerationUsage?: (usage: AiTokenUsage) => Promise<void>;

  /** Verification usage 저장 callback입니다. */
  onVerificationUsage?: (usage: AiTokenUsage) => Promise<void>;

  /** 추천 결과 snapshot 저장 callback입니다. */
  onRecommendations?: (
    recommendations: Awaited<
      ReturnType<typeof verifyRelatedNoteRecommendations>
    >["recommendations"],
  ) => Promise<void>;

  /** Verification 결과 snapshot 저장 callback입니다. */
  onVerificationResults?: (
    verifications: RelatedNoteVerification[],
  ) => Promise<void>;
};

/**
 * Note의 관련 노트 추천을 실행합니다.
 *
 * Query Expansion으로 관련 노트 검색 질의를 생성하고,
 * 기존 Note RAG를 통해 Context를 구성한 뒤,
 * 검색된 Note가 있는 경우 Answer Agent를 사용하여 추천 Note를 결정합니다.
 *
 * Query Expansion Provider usage와 확정된 expanded query는 별도 callback으로
 * 전달하여 응답 파싱/검증 실패 시에도 이미 발생한 usage를 보존합니다.
 *
 * 검색된 Note가 없으면 추천 후보가 존재하지 않으므로
 * 불필요한 Answer Agent 호출 없이 빈 추천 결과를 반환합니다.
 *
 * @param params 관련 노트 추천 실행에 필요한 입력과 Runtime 설정입니다.
 * @returns 확장 질의, 검색된 Note 및 `{ noteId, title, reason }` 추천 항목입니다.
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
  onQueryExpansionUsage,
  onExpandedQuery,
  onQueryEmbeddingUsage,
  onMatchedNotes,
  onAnswerGenerationUsage,
  onVerificationUsage,
  onRecommendations,
  onVerificationResults,
}: RunRelatedNoteRecommendationParams) {
  const contextResult = await prepareRelatedNoteContext({
    content,
    embeddingConfiguration,
    limit,
    minSimilarity,
    ...(onQueryExpansionUsage !== undefined ? { onQueryExpansionUsage } : {}),
    ...(onExpandedQuery !== undefined ? { onExpandedQuery } : {}),
    ...(onQueryEmbeddingUsage !== undefined ? { onQueryEmbeddingUsage } : {}),
    ownerUserId,
    queryExpansionConfiguration,
    targetNoteId,
    title,
  });

  await onMatchedNotes?.(contextResult.notes.map((note) => note.id));

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
    await onRecommendations?.([]);

    return {
      expandedQuery: contextResult.expandedQuery,
      notes: [],
      recommendations: [],
      queryEmbeddingUsage: contextResult.queryEmbeddingUsage,
      queryExpansionUsage: contextResult.queryExpansionUsage,
    };
  }

  const recommendationResult = await generateRelatedNoteRecommendations({
    configuration: answerConfiguration,
    content,
    context: contextResult.context,
    notes: contextResult.notes,
    title,
    ...(onAnswerGenerationUsage !== undefined
      ? { onUsage: onAnswerGenerationUsage }
      : {}),
  });

  /*
   * Answer Agent가 추천을 만들지 않은 경우에는 검증할 대상이 없으므로
   * Verifier 호출을 생략하고 빈 추천을 그대로 저장 단계로 전달합니다.
   */
  if (recommendationResult.recommendations.length === 0) {
    await onRecommendations?.([]);

    return {
      answerGenerationUsage: recommendationResult.usage,
      expandedQuery: contextResult.expandedQuery,
      notes: contextResult.notes,
      queryEmbeddingUsage: contextResult.queryEmbeddingUsage,
      queryExpansionUsage: contextResult.queryExpansionUsage,
      recommendations: [],
    };
  }

  const verificationResult = await verifyRelatedNoteRecommendations({
    configuration: verificationConfiguration,
    content,
    notes: contextResult.notes,
    recommendations: recommendationResult.recommendations,
    title,
    ...(onVerificationUsage !== undefined
      ? { onUsage: onVerificationUsage }
      : {}),
  });

  await onVerificationResults?.(verificationResult.verifications);
  await onRecommendations?.(verificationResult.recommendations);

  return {
    answerGenerationUsage: recommendationResult.usage,
    expandedQuery: contextResult.expandedQuery,
    notes: contextResult.notes,
    queryEmbeddingUsage: contextResult.queryEmbeddingUsage,
    queryExpansionUsage: contextResult.queryExpansionUsage,
    recommendations: verificationResult.recommendations,
    verificationUsage: verificationResult.usage,
    verifications: verificationResult.verifications,
  };
}
