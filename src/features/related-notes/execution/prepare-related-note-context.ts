import { getMatchedNotes } from "@/features/ai/rags/note/get-matched-notes";
import { searchNoteEmbeddings } from "@/features/ai/rags/note/search-embeddings";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";

import { buildRelatedNoteContext } from "./build-related-note-context";
import { expandRelatedNoteQuery } from "./expand-related-note-query";
import { getRelatedNoteRecommendationExcludedIds } from "./get-related-note-recommendation-excluded-ids";

type PrepareRelatedNoteContextParams = {
  /** 관련 노트를 추천할 대상 Note의 제목입니다. */
  title: string;

  /** 관련 노트를 추천할 대상 Note의 내용입니다. */
  content: string;

  /** Query Expansion에 사용할 Chat Runtime Configuration입니다. */
  queryExpansionConfiguration: Parameters<
    typeof expandRelatedNoteQuery
  >[0]["configuration"];

  /** Note RAG 검색에 사용할 Embedding Runtime Configuration입니다. */
  embeddingConfiguration: AiRuntimeEmbeddingConfiguration;

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
 * Note의 제목과 내용을 기반으로 관련 노트 검색에 필요한 Context를 준비합니다.
 *
 * Query Expansion으로 검색 질의를 생성한 뒤 기존 Note RAG 검색 로직을
 * 그대로 사용하여 관련 Note를 검색하고 LLM Context로 변환합니다.
 *
 * @param params 관련 노트 추천 실행에 필요한 입력과 Runtime 설정
 * @returns 확장 질의와 검색된 Note 및 LLM Context
 */
export async function prepareRelatedNoteContext({
  title,
  content,
  queryExpansionConfiguration,
  embeddingConfiguration,
  ownerUserId,
  targetNoteId,
  limit,
  minSimilarity,
}: PrepareRelatedNoteContextParams) {
  // 대상 Note의 제목과 내용을 기반으로 Related Notes 검색에 사용할 질의를 생성합니다.
  const expandedQuery = await expandRelatedNoteQuery({
    configuration: queryExpansionConfiguration,
    title,
    content,
  });

  // 기존 관계를 조회하여 AI 추천 검색에서 제외해야 할 Note ID를 가져옵니다.
  const excludedRelatedNoteIds = await getRelatedNoteRecommendationExcludedIds({
    noteId: targetNoteId,
    ownerUserId,
  });

  // 확장된 질의를 임베딩하여 관련 Note chunk를 검색합니다.
  // 추천 대상 Note 자신과 기존 관계에서 제외된 Note는 검색 후보에서 제외합니다.
  const matches = await searchNoteEmbeddings({
    embeddingConfiguration,
    excludeSourceIds: [targetNoteId, ...excludedRelatedNoteIds],
    ownerUserId,
    question: expandedQuery,
    limit,
    minSimilarity,
  });

  // 검색된 embedding 결과를 실제 Note 정보와 결합합니다.
  const notes = await getMatchedNotes({
    matches,
    ownerUserId,
  });

  // 검색된 Note chunk를 Answer Agent에 전달할 Related Notes Context로 구성합니다.
  const context = buildRelatedNoteContext({
    notes,
  });

  // 이후 추천 생성 단계에서 사용할 Context 준비 결과를 반환합니다.
  return {
    context,
    expandedQuery,
    notes,
  };
}
