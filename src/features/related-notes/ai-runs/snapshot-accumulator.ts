import type { AiEmbeddingMatchRow } from "@/features/ai/embeddings/types";
import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";
import { createAiRunSnapshotAccumulator } from "@/features/ai/runs/snapshot-accumulator";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";

import {
  type RelatedNotesSnapshots,
  relatedNotesSnapshotsSchema,
} from "./snapshot-schema";

/** Optional stage를 제외한 Related Notes Snapshot stage 이름입니다. */
type RelatedNotesStageName = Exclude<
  keyof RelatedNotesSnapshots,
  "schemaVersion" | "sourceInput" | "finalOutput"
>;

/** 지정한 Related Notes Snapshot stage의 실제 값 타입입니다. */
type RelatedNotesStageValue<TName extends RelatedNotesStageName> = NonNullable<
  RelatedNotesSnapshots[TName]
>;

/** Related Notes 실행별 Snapshot accumulator 공개 계약입니다. */
export type RelatedNotesSnapshotAccumulator = {
  buildSnapshot: () => unknown;
  setStage: <TName extends RelatedNotesStageName>(
    name: TName,
    value: RelatedNotesStageValue<TName>,
  ) => void;
  updateStage: <TName extends RelatedNotesStageName>(
    name: TName,
    update: (value: RelatedNotesStageValue<TName>) => void,
  ) => void;
  completeFinalOutput: (
    recommendations: Array<{ noteId: string; reason: string }>,
  ) => void;
};

/** Related Notes AI 실행의 source Note 입력입니다. */
export type RelatedNotesSnapshotSourceInput = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

/** 오류 값을 Snapshot 정본의 최소 오류 형태로 변환합니다. */
export function describeRelatedNotesSnapshotError(
  error: unknown,
  issues?: unknown[],
): { message: string; type?: string; issues?: unknown[] } {
  const description =
    error instanceof Error
      ? { message: error.message, type: error.name }
      : { message: "Unknown error" };

  return {
    ...description,
    ...(issues === undefined ? {} : { issues }),
  };
}

/** Runtime Chat Model을 정본 Snapshot 필드로 매핑합니다. */
export function mapRelatedNotesChatModel(
  configuration: AiRuntimeChatConfiguration,
) {
  return {
    id: configuration.model.id,
    model: configuration.model.model,
    provider: configuration.model.provider,
  };
}

/** Runtime Prompt를 정본 Snapshot 필드로 매핑합니다. */
export function mapRelatedNotesPrompt(
  configuration: AiRuntimeChatConfiguration,
) {
  return {
    agent: { ...configuration.prompt.agent },
    family: { ...configuration.prompt.family },
    version: { ...configuration.prompt.version },
  };
}

/** 검색 match를 vector 없이 정본 Snapshot 항목으로 매핑합니다. */
export function mapRelatedNotesSearchMatch(match: AiEmbeddingMatchRow) {
  return {
    chunkIndex: match.chunk_index,
    distance: match.distance,
    embeddingId: match.embedding_id,
    similarity: match.similarity,
    sourceId: match.source_id,
  };
}

/** Hydration 결과를 Related Notes candidate Snapshot으로 매핑합니다. */
export function mapRelatedNotesMatchedNote(note: MatchedNote) {
  return {
    chunkText: note.chunkText,
    distance: note.distance,
    embeddingId: note.embeddingId,
    noteId: note.id,
    similarity: note.similarity,
    title: note.title,
  };
}

/** 한 Related Notes AI 실행의 run-local Snapshot accumulator를 생성합니다. */
export function createRelatedNotesSnapshotAccumulator(
  source: RelatedNotesSnapshotSourceInput,
): RelatedNotesSnapshotAccumulator {
  const accumulator = createAiRunSnapshotAccumulator<RelatedNotesSnapshots>(
    {
      schemaVersion: 1,
      sourceInput: {
        input: {
          note: {
            content: source.content,
            id: source.id,
            title: source.title,
            updatedAt: source.updatedAt,
          },
        },
      },
    },
    (state) => relatedNotesSnapshotsSchema.parse(state),
  );

  return {
    buildSnapshot: accumulator.buildSnapshot,
    setStage: (name, value) => {
      // 병렬 stage가 서로의 값을 덮어쓰지 않도록 해당 key만 갱신한다.
      accumulator.mutate((state) => {
        state[name] = value;
      });
    },
    updateStage: (name, update) => {
      // 이미 시작된 stage가 있을 때만 확보된 후속 관측값을 합친다.
      accumulator.mutate((state) => {
        const value = state[name];
        if (value !== undefined) {
          update(value);
        }
      });
    },
    completeFinalOutput: (recommendations) => {
      accumulator.mutate((state) => {
        state.finalOutput = { recommendations };
      });
    },
  };
}
