import type { AiTokenUsage } from "@/features/ai/providers/types";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";

import {
  describeRelatedNotesSnapshotError,
  mapRelatedNotesChatModel,
  mapRelatedNotesPrompt,
  type RelatedNotesSnapshotAccumulator,
} from "../ai-runs/snapshot-accumulator";
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

  /** 현재 실행의 Related Notes Snapshot accumulator입니다. */
  snapshotAccumulator?: RelatedNotesSnapshotAccumulator;

  /** Retrieval 또는 Answer 완료 뒤 전체 Snapshot checkpoint callback입니다. */
  onCheckpoint?: () => void | Promise<void>;
};

/**
 * 실제 stage에서 사용한 후보를 Retrieval 정본 후보의 index로 변환합니다.
 *
 * 같은 Note의 여러 chunk는 서로 다른 embeddingId를 가지므로
 * Note ID가 아니라 embeddingId를 기준으로 대응시킵니다.
 *
 * 정본 후보에서 대응 항목을 찾지 못한 경우 dangling index를 만들거나
 * 실행을 실패시키지 않고 Snapshot stage 기록을 생략할 수 있도록 null을 반환합니다.
 */
function resolveMatchedCandidateIndexes(
  hydratedCandidates: Array<{ embeddingId: string }>,
  matchedCandidates: Array<{ embeddingId: string }>,
): number[] | null {
  const indexByEmbeddingId = new Map(
    hydratedCandidates.map((candidate, index) => [
      candidate.embeddingId,
      index,
    ]),
  );

  const indexes = matchedCandidates.map((candidate) =>
    indexByEmbeddingId.get(candidate.embeddingId),
  );

  if (indexes.some((index) => index === undefined)) {
    return null;
  }

  return indexes as number[];
}

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
  snapshotAccumulator,
  onCheckpoint,
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
    ...(snapshotAccumulator === undefined ? {} : { snapshotAccumulator }),
    targetNoteId,
    title,
  });

  // Retrieval hydration과 Context가 확정된 전체 Snapshot을 저장한다.
  await onCheckpoint?.();

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
    snapshotAccumulator?.setStage("answerGeneration", {
      skipped: { reason: "no_candidates" },
    });
    snapshotAccumulator?.setStage("verification", {
      skipped: { reason: "no_candidates" },
    });
    snapshotAccumulator?.completeFinalOutput([]);
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
    onObservation: (observation) => {
      if (observation.type === "prepared") {
        const matchedCandidateIndexes = resolveMatchedCandidateIndexes(
          contextResult.notes,
          observation.notes,
        );

        if (matchedCandidateIndexes === null) return;

        snapshotAccumulator?.setStage("answerGeneration", {
          configuration: {
            model: mapRelatedNotesChatModel(observation.configuration),
            prompt: mapRelatedNotesPrompt(observation.configuration),
            ...(observation.responseFormat === undefined
              ? {}
              : { responseFormat: observation.responseFormat }),
            temperature: observation.configuration.temperature,
          },
          input: {
            context: observation.context,
            matchedCandidateIndexes,
            renderedSystemPrompt: observation.systemPrompt,
            renderedUserPrompt: observation.userPrompt,
            source: { content, title },
            variables: observation.variables,
          },
        });
      } else {
        snapshotAccumulator?.updateStage("answerGeneration", (stage) => {
          if (!("configuration" in stage)) return;
          if (observation.type === "provider-completed") {
            stage.output = {
              providerMetadata: observation.result.metadata,
              rawResponse: observation.result.content,
            };
            stage.usage = observation.result.usage;
          } else if (observation.type === "parsed" && stage.output) {
            stage.output.parsed = {
              recommendations: observation.recommendations,
            };
          } else if (observation.type === "post-processed") {
            stage.postProcessing = {
              resolvedRecommendations: observation.recommendations,
            };
          } else if (observation.type === "failed") {
            stage.error = describeRelatedNotesSnapshotError(
              observation.error,
              observation.issues,
            );
          }
        });
      }
    },
  });

  // Answer parse/resolve/dedup 결과가 확정된 전체 Snapshot을 저장한다.
  await onCheckpoint?.();

  /*
   * Answer Agent가 추천을 만들지 않은 경우에는 검증할 대상이 없으므로
   * Verifier 호출을 생략하고 빈 추천을 그대로 저장 단계로 전달합니다.
   */
  if (recommendationResult.recommendations.length === 0) {
    snapshotAccumulator?.setStage("verification", {
      skipped: { reason: "no_recommendations" },
    });
    snapshotAccumulator?.completeFinalOutput([]);
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
    onObservation: (observation) => {
      if (observation.type === "prepared") {
        const matchedCandidateIndexes = resolveMatchedCandidateIndexes(
          contextResult.notes,
          observation.notes,
        );

        if (matchedCandidateIndexes === null) return;

        snapshotAccumulator?.setStage("verification", {
          configuration: {
            model: mapRelatedNotesChatModel(observation.configuration),
            prompt: mapRelatedNotesPrompt(observation.configuration),
            ...(observation.responseFormat === undefined
              ? {}
              : { responseFormat: observation.responseFormat }),
            temperature: observation.configuration.temperature,
          },
          input: {
            context: observation.context,
            matchedCandidateIndexes,
            recommendations: observation.recommendations,
            renderedSystemPrompt: observation.systemPrompt,
            renderedUserPrompt: observation.userPrompt,
            source: { content, title },
            variables: observation.variables,
          },
        });
      } else {
        snapshotAccumulator?.updateStage("verification", (stage) => {
          if (!("configuration" in stage)) return;
          if (observation.type === "provider-completed") {
            stage.output = {
              providerMetadata: observation.result.metadata,
              rawResponse: observation.result.content,
            };
            stage.usage = observation.result.usage;
          } else if (observation.type === "parsed" && stage.output) {
            stage.output.parsed = { verifications: observation.verifications };
          } else if (observation.type === "id-consistency") {
            stage.postProcessing = { idConsistency: observation.value };
            if (
              observation.value.hasDuplicate ||
              observation.value.hasMissing ||
              observation.value.hasUnknown
            ) {
              stage.error = {
                message:
                  "Related note verification note IDs do not match recommendations.",
                type: "Error",
              };
            }
          } else if (observation.type === "post-processed") {
            stage.postProcessing = {
              ...(stage.postProcessing?.idConsistency === undefined
                ? {}
                : { idConsistency: stage.postProcessing.idConsistency }),
              orderedVerifications: observation.orderedVerifications,
              recommendations: observation.recommendations,
            };
          } else if (observation.type === "failed") {
            stage.error = describeRelatedNotesSnapshotError(
              observation.error,
              observation.issues,
            );
          }
        });
      }
    },
  });

  await onVerificationResults?.(verificationResult.verifications);
  snapshotAccumulator?.completeFinalOutput(verificationResult.recommendations);
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
