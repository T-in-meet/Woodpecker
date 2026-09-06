import type { AiTokenUsage } from "@/features/ai/providers/types";
import {
  NOTE_EMBEDDING_INPUT_KIND,
  NOTE_EMBEDDING_SOURCE_TYPE,
} from "@/features/ai/rags/note/constants/embeddings";
import {
  getMatchedNotes,
  type MatchedNote,
} from "@/features/ai/rags/note/get-matched-notes";
import { searchNoteEmbeddingsWithUsage } from "@/features/ai/rags/note/search-embeddings";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";

import {
  describeRelatedNotesSnapshotError,
  mapRelatedNotesChatModel,
  mapRelatedNotesMatchedNote,
  mapRelatedNotesPrompt,
  mapRelatedNotesSearchMatch,
  type RelatedNotesSnapshotAccumulator,
} from "../ai-runs/snapshot-accumulator";
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

  /** Query Expansion Provider usage 저장 callback입니다. */
  onQueryExpansionUsage?: (usage: AiTokenUsage) => Promise<void>;

  /** 파싱과 검증을 통과한 Query Expansion 검색 질의 저장 callback입니다. */
  onExpandedQuery?: (expandedQuery: string) => Promise<void>;

  /** Query embedding usage 저장 callback입니다. */
  onQueryEmbeddingUsage?: (usage: AiTokenUsage) => Promise<void>;

  /** 현재 실행의 AI Runs Snapshot accumulator입니다. */
  snapshotAccumulator?: RelatedNotesSnapshotAccumulator;
};

/**
 * Note의 제목과 내용을 기반으로 관련 노트 검색에 필요한 Context를 준비합니다.
 *
 * Query Expansion으로 검색 질의를 생성한 뒤 기존 Note RAG 검색 로직을
 * 그대로 사용하여 관련 Note를 검색하고 LLM Context로 변환합니다.
 *
 * Query Expansion Provider usage는 응답 파싱/검증과 별도로 전달하여,
 * 이후 파싱 또는 검증에 실패하더라도 이미 발생한 usage/cost를
 * 실행 이력에 보존할 수 있도록 합니다.
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
  onQueryExpansionUsage,
  onExpandedQuery,
  onQueryEmbeddingUsage,
  snapshotAccumulator,
}: PrepareRelatedNoteContextParams) {
  /*
   * Query Expansion과 기존 관계 조회는 서로 의존하지 않으므로 동시에 시작합니다.
   * 확정된 expanded query 저장은 검색 query가 검증된 뒤에만 수행합니다.
   */
  const queryExpansionPromise = expandRelatedNoteQuery({
    configuration: queryExpansionConfiguration,
    noteId: targetNoteId,
    content,
    ...(onQueryExpansionUsage !== undefined
      ? { onUsage: onQueryExpansionUsage }
      : {}),
    onObservation: (observation) => {
      if (observation.type === "prepared") {
        snapshotAccumulator?.setStage("queryExpansion", {
          configuration: {
            model: mapRelatedNotesChatModel(observation.configuration),
            prompt: mapRelatedNotesPrompt(observation.configuration),
            ...(observation.responseFormat === undefined
              ? {}
              : { responseFormat: observation.responseFormat }),
            temperature: observation.configuration.temperature,
          },
          input: {
            renderedSystemPrompt: observation.systemPrompt,
            renderedUserPrompt: observation.userPrompt,
            source: { content, title },
            variables: { content, title },
          },
        });
      } else if (observation.type === "completed") {
        snapshotAccumulator?.updateStage("queryExpansion", (stage) => {
          if ("configuration" in stage) {
            stage.output = {
              providerMetadata: observation.result.metadata,
              rawResponse: observation.result.content,
            };
            stage.usage = observation.result.usage;
          }
        });
      } else {
        snapshotAccumulator?.updateStage("queryExpansion", (stage) => {
          if ("configuration" in stage) {
            stage.error = describeRelatedNotesSnapshotError(observation.error);
          }
        });
      }
    },
    onParsed: (observation) => {
      snapshotAccumulator?.updateStage("queryExpansion", (stage) => {
        if (!("configuration" in stage)) return;
        if (observation.type === "parsed" && stage.output) {
          stage.output.parsed = { expandedQuery: observation.expandedQuery };
        } else if (observation.type !== "parsed") {
          stage.error = describeRelatedNotesSnapshotError(
            observation.error,
            observation.type === "validation-failed"
              ? observation.issues
              : undefined,
          );
        }
      });
    },
    title,
  });

  snapshotAccumulator?.setStage("exclusions", {
    configuration: {
      excludeActiveAi: false,
      excludeDismissedAi: true,
      excludeManual: true,
      excludeTargetNote: true,
      resolveRelationBidirectionally: true,
    },
    input: { targetNoteId },
  });

  const excludedRelatedNoteIdsPromise = getRelatedNoteRecommendationExcludedIds(
    {
      noteId: targetNoteId,
      ownerUserId,
    },
  ).then(
    (excludedRelatedNoteIds) => {
      snapshotAccumulator?.updateStage("exclusions", (stage) => {
        if ("configuration" in stage) {
          stage.output = {
            excludedRelatedNoteIds,
            excludeSourceIds: [targetNoteId, ...excludedRelatedNoteIds],
          };
        }
      });
      return excludedRelatedNoteIds;
    },
    (error: unknown) => {
      snapshotAccumulator?.updateStage("exclusions", (stage) => {
        if ("configuration" in stage) {
          stage.error = describeRelatedNotesSnapshotError(error);
        }
      });
      throw error;
    },
  );

  const [queryExpansionResult, excludedRelatedNoteIds] = await Promise.all([
    queryExpansionPromise,
    excludedRelatedNoteIdsPromise,
  ]);
  const expandedQuery = queryExpansionResult.expandedQuery;

  /*
   * 파싱과 검증을 통과하여 확정된 검색 질의만 별도로 전달합니다.
   *
   * Provider usage는 expandRelatedNoteQuery의 onUsage 경로에서 이미
   * 전달되므로 여기서는 usage를 다시 저장하지 않습니다.
   */
  await onExpandedQuery?.(expandedQuery);

  const excludeSourceIds = [targetNoteId, ...excludedRelatedNoteIds];

  snapshotAccumulator?.setStage("retrieval", {
    configuration: {
      embeddingModel: {
        dimensions: embeddingConfiguration.model.dimensions,
        id: embeddingConfiguration.model.id,
        model: embeddingConfiguration.model.model,
        provider: embeddingConfiguration.model.provider,
      },
      search: {
        inputKind: NOTE_EMBEDDING_INPUT_KIND,
        limit,
        minSimilarity,
        sourceType: NOTE_EMBEDDING_SOURCE_TYPE,
      },
    },
    input: { excludeSourceIds, inputText: expandedQuery },
  });

  // 확장된 질의를 임베딩하여 관련 Note chunk를 검색합니다.
  // 추천 대상 Note 자신과 기존 관계에서 제외된 Note는 검색 후보에서 제외합니다.
  //
  // 현재는 Note 단위 후보 수를 보장하거나 중복 제거하지 않고,
  // 유사도가 높은 chunk를 우선하여 Answer Agent Context에 전달합니다.
  // 따라서 동일 Note의 여러 chunk가 검색 결과에 포함될 수 있으며,
  // 실제 후보 Note 수는 검색 limit보다 적을 수 있습니다.
  //
  // 이는 동일 Note의 여러 관련 근거를 추천 판단에 함께 활용하기 위한 정책입니다.
  // 특정 Note의 chunk 편중이 추천 품질에 영향을 주는 경우,
  // Note 단위 grouping이나 검색 결과 다양화 방식을 별도로 검토합니다.
  let searchResult: Awaited<ReturnType<typeof searchNoteEmbeddingsWithUsage>>;

  try {
    searchResult = await searchNoteEmbeddingsWithUsage({
      embeddingConfiguration,
      excludeSourceIds,
      ownerUserId,
      question: expandedQuery,
      limit,
      minSimilarity,
      ...(onQueryEmbeddingUsage !== undefined
        ? { onUsage: onQueryEmbeddingUsage }
        : {}),
      onObservation: (observation) => {
        snapshotAccumulator?.updateStage("retrieval", (stage) => {
          if (!("configuration" in stage)) return;
          if (observation.type === "embedding-completed") {
            stage.embedding = {
              providerMetadata: observation.metadata,
              usage: observation.usage,
            };
          } else if (observation.type === "search-completed") {
            stage.searchResult = {
              matches: observation.matches.map(mapRelatedNotesSearchMatch),
            };
          } else if (
            observation.type === "embedding-failed" ||
            observation.type === "search-failed"
          ) {
            stage.error = describeRelatedNotesSnapshotError(observation.error);
          }
        });
      },
    });
  } catch (error) {
    // Provider validation처럼 observer 이전에 실패한 경우도 retrieval 실패로 남긴다.
    snapshotAccumulator?.updateStage("retrieval", (stage) => {
      if ("configuration" in stage) {
        stage.error = describeRelatedNotesSnapshotError(error);
      }
    });
    throw error;
  }

  let notes: MatchedNote[];

  try {
    // 검색된 embedding 결과를 실제 Note 정보와 결합합니다.
    notes = await getMatchedNotes({
      matches: searchResult.matches,
      ownerUserId,
    });
    snapshotAccumulator?.updateStage("retrieval", (stage) => {
      if ("configuration" in stage) {
        stage.hydratedCandidates = notes.map(mapRelatedNotesMatchedNote);
      }
    });
  } catch (error) {
    snapshotAccumulator?.updateStage("retrieval", (stage) => {
      if ("configuration" in stage) {
        stage.error = describeRelatedNotesSnapshotError(error);
      }
    });
    throw error;
  }

  let context: string;

  try {
    // 검색된 Note chunk를 Answer Agent에 전달할 Related Notes Context로 구성합니다.
    context = buildRelatedNoteContext({ notes });
    snapshotAccumulator?.updateStage("retrieval", (stage) => {
      if ("configuration" in stage) {
        stage.output = { context };
      }
    });
  } catch (error) {
    snapshotAccumulator?.updateStage("retrieval", (stage) => {
      if ("configuration" in stage) {
        stage.error = describeRelatedNotesSnapshotError(error);
      }
    });
    throw error;
  }

  // 이후 추천 생성 단계에서 사용할 Context 준비 결과를 반환합니다.
  return {
    context,
    expandedQuery,
    notes,
    queryEmbeddingUsage: searchResult.usage,
    queryExpansionUsage: queryExpansionResult.usage,
  };
}
