import type { AiEmbeddingMatchRow } from "@/features/ai/embeddings/types";
import type { AiChatStreamResult } from "@/features/ai/providers/types";
import {
  NOTE_EMBEDDING_INPUT_KIND,
  NOTE_EMBEDDING_SOURCE_TYPE,
} from "@/features/ai/rags/note/constants/embeddings";
import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";
import type { SearchNoteEmbeddingsObservation } from "@/features/ai/rags/note/search-embeddings";
import type { QueryExpansionCompletionObservation } from "@/features/ai/rags/query-expansion/create-query-expansion-completion";
import { createAiRunSnapshotAccumulator } from "@/features/ai/runs/snapshot-accumulator";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";
import type { Json } from "@/types/db.helpers";

import type { NoteChatNoteSource } from "../execution/build-note-sources";
import type { NoteChatProviderResponse } from "../execution/parse-response";
import {
  type NoteChatSnapshots,
  noteChatSnapshotsSchema,
  type RetrievalErrorStage,
} from "./snapshot-schema";

/** Note Chat Snapshot의 Query Expansion 대화 이력 항목입니다. */
export type NoteChatSnapshotHistoryMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

/** Answer Generation 실패 stage입니다. */
export type NoteChatAnswerErrorStage =
  | "provider_call"
  | "stream_consumption"
  | "parse"
  | "validation"
  | "post_processing";

/** Note Chat 실행별 Snapshot accumulator 공개 계약입니다. */
export type NoteChatSnapshotAccumulator = {
  buildSnapshot: () => unknown;
  observeQueryExpansion: (
    observation: QueryExpansionCompletionObservation,
  ) => void;
  prepareQueryExpansion: (input: {
    history: NoteChatSnapshotHistoryMessage[];
    question: string;
  }) => void;
  completeQueryExpansion: (expandedQuery: string) => void;
  failQueryExpansion: (error: unknown, validationIssues?: unknown[]) => void;
  observeRetrieval: (observation: SearchNoteEmbeddingsObservation) => void;
  prepareRetrieval: (input: {
    configuration: AiRuntimeEmbeddingConfiguration;
    inputText: string;
    contextLimit: number;
    matchLimit: number;
    minSimilarity: number;
  }) => void;
  completeRetrieval: (input: {
    context: string;
    hydratedCandidates: MatchedNote[];
    selectedContext: MatchedNote[];
    sources: Json[];
  }) => void;
  failRetrieval: (stage: RetrievalErrorStage, error: unknown) => void;
  prepareAnswerGeneration: (input: {
    configuration: AiRuntimeChatConfiguration;
    context: string;
    history: NoteChatSnapshotHistoryMessage[];
    providerMessages: Array<{ role: string; content: unknown }>;
    question: string;
    responseFormat?: unknown;
  }) => void;
  appendAnswerPartialResponse: (input: {
    partialResponse: string;
    rawResponse: string;
  }) => void;
  completeAnswerGenerationProvider: (result: AiChatStreamResult) => void;
  completeAnswerGenerationParsing: (parsed: NoteChatProviderResponse) => void;
  completeAnswerGenerationPostProcessing: (input: {
    usedContextIndexes: number[];
    usedNoteIds: string[];
  }) => void;
  failAnswerGeneration: (
    stage: NoteChatAnswerErrorStage,
    error: unknown,
  ) => void;
  completeGeneratedAnswer: (answer: string, usedNoteIds: string[]) => void;
  completeNoContextAnswer: (answer: string) => void;
};

/** 오류 값을 Snapshot에 저장할 최소 공통 형태로 변환합니다. */
function describeError(error: unknown): { message: string; type?: string } {
  if (error instanceof Error) {
    return { message: error.message, type: error.name };
  }

  return { message: "Unknown error" };
}

/** Runtime Chat Model을 정본 Snapshot 필드로 명시적으로 매핑합니다. */
function mapChatModel(configuration: AiRuntimeChatConfiguration) {
  return {
    id: configuration.model.id,
    model: configuration.model.model,
    provider: configuration.model.provider,
  };
}

/** Runtime Prompt를 정본 Snapshot 필드로 명시적으로 매핑합니다. */
function mapPrompt(configuration: AiRuntimeChatConfiguration) {
  return {
    agent: { ...configuration.prompt.agent },
    agentId: configuration.prompt.agent.id,
    family: { ...configuration.prompt.family },
    familyId: configuration.prompt.family.id,
    version: { ...configuration.prompt.version },
    versionId: configuration.prompt.version.id,
  };
}

/** 검색 match를 vector 없이 정본 Snapshot 항목으로 변환합니다. */
function mapSearchMatch(match: AiEmbeddingMatchRow) {
  return {
    distance: match.distance,
    embeddingId: match.embedding_id,
    noteId: match.source_id,
    raw: { ...match },
    similarity: match.similarity,
    sourceId: match.source_id,
  };
}

/** Hydration 결과를 정본 candidate Snapshot 항목으로 변환합니다. */
function mapHydratedCandidate(note: MatchedNote) {
  return {
    chunk: { id: note.embeddingId, inputText: note.chunkText },
    distance: note.distance,
    embeddingId: note.embeddingId,
    note: { id: note.id, title: note.title },
    noteId: note.id,
    similarity: note.similarity,
    sourceId: note.id,
  };
}

/** 선택된 Context 후보를 Hydration 후보 배열 내부 index로 변환합니다. */
function mapSelectedCandidateIndexes(
  hydratedCandidates: MatchedNote[],
  selectedContext: MatchedNote[],
) {
  return selectedContext.map((selectedCandidate) =>
    hydratedCandidates.findIndex(
      (candidate) => candidate.embeddingId === selectedCandidate.embeddingId,
    ),
  );
}

/** 기존 실행 source를 정본 Retrieval source Snapshot으로 변환합니다. */
function mapRetrievalSource(source: Json) {
  const parsed = source as NoteChatNoteSource;

  return {
    embeddingId: parsed.embeddingId,
    inputText: parsed.content,
    noteId: parsed.noteId,
    sourceId: parsed.noteId,
    title: parsed.title,
  };
}

/** 한 Note Chat AI 실행의 mutable Snapshot accumulator를 생성합니다. */
export function createNoteChatSnapshotAccumulator(): NoteChatSnapshotAccumulator {
  let queryExpansionInput: {
    history: NoteChatSnapshotHistoryMessage[];
    question: string;
  } | null = null;

  const accumulator = createAiRunSnapshotAccumulator<NoteChatSnapshots>(
    { schemaVersion: 1 },
    (state) => noteChatSnapshotsSchema.parse(state),
  );

  return {
    buildSnapshot: accumulator.buildSnapshot,
    prepareQueryExpansion: (input) => {
      // 정본 stage 필수값이 모두 확보될 때까지 입력만 run-local 메모리에 보존한다.
      queryExpansionInput = input;
    },
    observeQueryExpansion: (observation) => {
      accumulator.mutate((state) => {
        if (observation.type === "prepared") {
          if (queryExpansionInput === null) return;
          state.queryExpansion = {
            configuration: {
              model: mapChatModel(observation.configuration),
              prompt: mapPrompt(observation.configuration),
              responseFormat: observation.responseFormat,
              temperature: observation.configuration.temperature,
            },
            input: {
              history: queryExpansionInput.history,
              providerInput: {
                systemPrompt: observation.systemPrompt,
                userPrompt: observation.userPrompt,
              },
              question: queryExpansionInput.question,
              variables: observation.variables,
            },
          };
          return;
        }

        const stage = state.queryExpansion;
        if (!stage) return;

        if (observation.type === "completed") {
          stage.output = { rawResponse: observation.result.content };
          stage.usage = observation.result.usage;
          return;
        }

        stage.error = {
          ...describeError(observation.error),
          providerError: observation.error,
        };
      });
    },
    completeQueryExpansion: (expandedQuery) => {
      accumulator.mutate((state) => {
        if (state.queryExpansion?.output) {
          state.queryExpansion.output.parsed = { expandedQuery };
        }
      });
    },
    failQueryExpansion: (error, validationIssues) => {
      accumulator.mutate((state) => {
        if (!state.queryExpansion) return;
        state.queryExpansion.error = {
          ...describeError(error),
          ...(state.queryExpansion.output === undefined
            ? {}
            : { rawResponse: state.queryExpansion.output.rawResponse }),
          ...(validationIssues === undefined ? {} : { validationIssues }),
        };
      });
    },
    observeRetrieval: (observation) => {
      accumulator.mutate((state) => {
        if (observation.type === "embedding-requested") {
          if (state.retrieval) {
            state.retrieval.input.inputText = observation.input;
          }
          return;
        }

        const stage = state.retrieval;
        if (!stage) return;

        if (observation.type === "embedding-completed") {
          stage.embedding = {
            metadata: observation.metadata as Record<string, unknown>,
            usage: {
              inputTokens: observation.usage.inputTokens,
              totalTokens: observation.usage.totalTokens,
            },
          };
        } else if (observation.type === "search-requested") {
          stage.configuration.search.matchLimit = observation.limit;
          stage.configuration.search.minSimilarity = observation.minSimilarity;
        } else if (observation.type === "search-completed") {
          stage.searchResult = {
            matches: observation.matches.map(mapSearchMatch),
          };
        } else if (observation.type === "embedding-failed") {
          stage.error = {
            ...describeError(observation.error),
            providerError: observation.error,
            stage: "embedding",
          };
        } else if (observation.type === "search-failed") {
          stage.error = {
            ...describeError(observation.error),
            details: observation.error,
            stage: "search",
          };
        }
      });
    },
    prepareRetrieval: (input) => {
      accumulator.mutate((state) => {
        state.retrieval = {
          configuration: {
            ...(input.configuration.model.dimensions === null
              ? {}
              : { dimensions: input.configuration.model.dimensions }),
            embeddingModel: {
              id: input.configuration.model.id,
              model: input.configuration.model.model,
              provider: input.configuration.model.provider,
            },
            search: {
              contextLimit: input.contextLimit,
              inputKind: NOTE_EMBEDDING_INPUT_KIND,
              matchLimit: input.matchLimit,
              minSimilarity: input.minSimilarity,
              sourceType: NOTE_EMBEDDING_SOURCE_TYPE,
            },
          },
          input: { inputText: input.inputText },
        };
      });
    },
    completeRetrieval: (input) => {
      accumulator.mutate((state) => {
        if (!state.retrieval || state.retrieval.error) return;
        state.retrieval.hydratedCandidates =
          input.hydratedCandidates.map(mapHydratedCandidate);
        state.retrieval.output = {
          context: input.context,
          selectedCandidateIndexes: mapSelectedCandidateIndexes(
            input.hydratedCandidates,
            input.selectedContext,
          ),
          sources: input.sources.map(mapRetrievalSource),
        };
      });
    },
    failRetrieval: (stage, error) => {
      accumulator.mutate((state) => {
        if (!state.retrieval) return;
        state.retrieval.error = {
          ...describeError(error),
          details: error,
          stage,
        };
      });
    },
    prepareAnswerGeneration: (input) => {
      accumulator.mutate((state) => {
        state.answerGeneration = {
          configuration: {
            model: mapChatModel(input.configuration),
            prompt: mapPrompt(input.configuration),
            ...(input.responseFormat === undefined
              ? {}
              : { responseFormat: input.responseFormat }),
            temperature: input.configuration.temperature,
          },
          input: {
            context: input.context,
            history: input.history,
            providerMessages: input.providerMessages,
            question: input.question,
          },
          status: "executed",
        };
      });
    },
    appendAnswerPartialResponse: (input) => {
      accumulator.mutate((state) => {
        if (state.answerGeneration?.status !== "executed") return;
        state.answerGeneration.output = {
          partialResponse: input.partialResponse,
          rawResponse: input.rawResponse,
        };
      });
    },
    completeAnswerGenerationProvider: (result) => {
      accumulator.mutate((state) => {
        if (state.answerGeneration?.status !== "executed") return;
        state.answerGeneration.output = {
          ...(state.answerGeneration.output?.partialResponse === undefined
            ? {}
            : {
                partialResponse: state.answerGeneration.output.partialResponse,
              }),
          rawResponse: result.content,
        };
        state.answerGeneration.usage = result.usage;
      });
    },
    completeAnswerGenerationParsing: (parsed) => {
      accumulator.mutate((state) => {
        if (
          state.answerGeneration?.status !== "executed" ||
          !state.answerGeneration.output
        ) {
          return;
        }
        state.answerGeneration.output.parsed = parsed;
      });
    },
    completeAnswerGenerationPostProcessing: (input) => {
      accumulator.mutate((state) => {
        if (state.answerGeneration?.status !== "executed") return;
        state.answerGeneration.postProcessing = input;
      });
    },
    failAnswerGeneration: (stage, error) => {
      accumulator.mutate((state) => {
        if (state.answerGeneration?.status !== "executed") return;
        state.answerGeneration.error = {
          ...describeError(error),
          ...(state.answerGeneration.output?.rawResponse === undefined
            ? {}
            : { rawResponse: state.answerGeneration.output.rawResponse }),
          ...(state.answerGeneration.output?.partialResponse === undefined
            ? {}
            : {
                partialResponse: state.answerGeneration.output.partialResponse,
              }),
          ...(stage === "provider_call" || stage === "stream_consumption"
            ? { providerError: error }
            : {}),
          stage,
        };
      });
    },
    completeGeneratedAnswer: (answer, usedNoteIds) => {
      accumulator.mutate((state) => {
        state.finalOutput = {
          answer,
          type: "generated_answer",
          usedNoteIds,
        };
      });
    },
    completeNoContextAnswer: (answer) => {
      accumulator.mutate((state) => {
        state.answerGeneration = { reason: "no_context", status: "skipped" };
        state.finalOutput = { answer, type: "no_context", usedNoteIds: [] };
      });
    },
  };
}
