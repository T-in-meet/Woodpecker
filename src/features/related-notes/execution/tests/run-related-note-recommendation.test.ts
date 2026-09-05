import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRelatedNotesSnapshotAccumulator } from "../../ai-runs/snapshot-accumulator";
import { generateRelatedNoteRecommendations } from "../generate-related-note-recommendations";
import { prepareRelatedNoteContext } from "../prepare-related-note-context";
import { runRelatedNoteRecommendation } from "../run-related-note-recommendation";
import { verifyRelatedNoteRecommendations } from "../verify-related-note-recommendations";

vi.mock("../generate-related-note-recommendations", () => ({
  generateRelatedNoteRecommendations: vi.fn(),
}));

vi.mock("../prepare-related-note-context", () => ({
  prepareRelatedNoteContext: vi.fn(),
}));

vi.mock("../verify-related-note-recommendations", () => ({
  verifyRelatedNoteRecommendations: vi.fn(),
}));

const mockPrepareRelatedNoteContext = vi.mocked(prepareRelatedNoteContext);
const mockGenerateRelatedNoteRecommendations = vi.mocked(
  generateRelatedNoteRecommendations,
);
const mockVerifyRelatedNoteRecommendations = vi.mocked(
  verifyRelatedNoteRecommendations,
);

const OWNER_USER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_NOTE_ID = "22222222-2222-4222-8222-222222222222";
const RELATED_NOTE_ID = "33333333-3333-4333-8333-333333333333";

const queryExpansionConfiguration = {} as Parameters<
  typeof runRelatedNoteRecommendation
>[0]["queryExpansionConfiguration"];

const embeddingConfiguration = {} as Parameters<
  typeof runRelatedNoteRecommendation
>[0]["embeddingConfiguration"];

const answerConfiguration = {} as Parameters<
  typeof runRelatedNoteRecommendation
>[0]["answerConfiguration"];

const verificationConfiguration = {} as Parameters<
  typeof runRelatedNoteRecommendation
>[0]["verificationConfiguration"];

const defaultParams = {
  answerConfiguration,
  content: "Source note content",
  embeddingConfiguration,
  limit: 5,
  minSimilarity: 0,
  ownerUserId: OWNER_USER_ID,
  queryExpansionConfiguration,
  targetNoteId: TARGET_NOTE_ID,
  title: "Source note",
  verificationConfiguration,
};

const queryExpansionUsage = {
  inputTokens: 1,
  outputTokens: 2,
  totalTokens: 3,
};

const queryEmbeddingUsage = {
  inputTokens: 4,
  outputTokens: 0,
  totalTokens: 4,
};

const answerGenerationUsage = {
  inputTokens: 5,
  outputTokens: 6,
  totalTokens: 11,
};

const verificationUsage = {
  inputTokens: 7,
  outputTokens: 8,
  totalTokens: 15,
};

describe("runRelatedNoteRecommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("검색된 Note가 있으면 Answer 추천 전체를 Verifier로 검증하고 승인된 결과를 반환한다", async () => {
    const notes = [
      {
        id: RELATED_NOTE_ID,
        title: "Related note",
      },
    ] as Awaited<ReturnType<typeof prepareRelatedNoteContext>>["notes"];

    mockPrepareRelatedNoteContext.mockResolvedValue({
      context: "<note>Related note</note>",
      expandedQuery: "expanded related note query",
      notes,
      queryEmbeddingUsage,
      queryExpansionUsage,
    });

    mockGenerateRelatedNoteRecommendations.mockResolvedValue({
      recommendations: [
        {
          noteId: RELATED_NOTE_ID,
          reason: "관련 노트 추천 이유",
          title: "Related note",
        },
      ],
      usage: answerGenerationUsage,
    });

    mockVerifyRelatedNoteRecommendations.mockResolvedValue({
      recommendations: [
        {
          noteId: RELATED_NOTE_ID,
          reason: "관련 노트 추천 이유",
        },
      ],
      usage: verificationUsage,
      verifications: [
        {
          approved: true,
          noteId: RELATED_NOTE_ID,
          reason: "직접적인 학습 관계가 있습니다.",
        },
      ],
    });

    const onQueryExpansionUsage = vi.fn().mockResolvedValue(undefined);
    const onExpandedQuery = vi.fn().mockResolvedValue(undefined);
    const onRecommendations = vi.fn().mockResolvedValue(undefined);
    const onVerificationResults = vi.fn().mockResolvedValue(undefined);

    const result = await runRelatedNoteRecommendation({
      ...defaultParams,
      onExpandedQuery,
      onRecommendations,
      onQueryExpansionUsage,
      onVerificationResults,
    });

    expect(mockPrepareRelatedNoteContext).toHaveBeenCalledWith({
      content: "Source note content",
      embeddingConfiguration,
      limit: 5,
      minSimilarity: 0,
      onExpandedQuery,
      onQueryExpansionUsage,
      ownerUserId: OWNER_USER_ID,
      queryExpansionConfiguration,
      targetNoteId: TARGET_NOTE_ID,
      title: "Source note",
    });

    expect(mockGenerateRelatedNoteRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: answerConfiguration,
        content: "Source note content",
        context: "<note>Related note</note>",
        notes,
        title: "Source note",
        onObservation: expect.any(Function),
      }),
    );

    expect(mockVerifyRelatedNoteRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: verificationConfiguration,
        content: "Source note content",
        notes,
        recommendations: [
          {
            noteId: RELATED_NOTE_ID,
            reason: "관련 노트 추천 이유",
            title: "Related note",
          },
        ],
        title: "Source note",
        onObservation: expect.any(Function),
      }),
    );

    expect(onVerificationResults).toHaveBeenCalledWith([
      {
        approved: true,
        noteId: RELATED_NOTE_ID,
        reason: "직접적인 학습 관계가 있습니다.",
      },
    ]);
    expect(onRecommendations).toHaveBeenCalledWith([
      {
        noteId: RELATED_NOTE_ID,
        reason: "관련 노트 추천 이유",
      },
    ]);

    expect(result).toEqual({
      answerGenerationUsage,
      expandedQuery: "expanded related note query",
      notes,
      queryEmbeddingUsage,
      queryExpansionUsage,
      recommendations: [
        {
          noteId: RELATED_NOTE_ID,
          reason: "관련 노트 추천 이유",
        },
      ],
      verificationUsage,
      verifications: [
        {
          approved: true,
          noteId: RELATED_NOTE_ID,
          reason: "직접적인 학습 관계가 있습니다.",
        },
      ],
    });
  });

  it("검색된 Note가 없으면 Answer Agent를 호출하지 않고 빈 추천을 반환한다", async () => {
    mockPrepareRelatedNoteContext.mockResolvedValue({
      context: "",
      expandedQuery: "expanded related note query",
      notes: [],
      queryEmbeddingUsage,
      queryExpansionUsage,
    });

    const onRecommendations = vi.fn().mockResolvedValue(undefined);

    const result = await runRelatedNoteRecommendation({
      ...defaultParams,
      onRecommendations,
    });

    expect(mockGenerateRelatedNoteRecommendations).not.toHaveBeenCalled();
    expect(mockVerifyRelatedNoteRecommendations).not.toHaveBeenCalled();
    expect(onRecommendations).toHaveBeenCalledWith([]);

    expect(result).toEqual({
      expandedQuery: "expanded related note query",
      notes: [],
      queryEmbeddingUsage,
      queryExpansionUsage,
      recommendations: [],
    });
  });

  it("Answer 추천이 비어 있으면 Verifier를 호출하지 않고 빈 추천을 반환한다", async () => {
    const notes = [
      {
        id: RELATED_NOTE_ID,
        title: "Related note",
      },
    ] as Awaited<ReturnType<typeof prepareRelatedNoteContext>>["notes"];

    mockPrepareRelatedNoteContext.mockResolvedValue({
      context: "<note>Related note</note>",
      expandedQuery: "expanded related note query",
      notes,
      queryEmbeddingUsage,
      queryExpansionUsage,
    });

    mockGenerateRelatedNoteRecommendations.mockResolvedValue({
      recommendations: [],
      usage: answerGenerationUsage,
    });

    const onRecommendations = vi.fn().mockResolvedValue(undefined);

    const result = await runRelatedNoteRecommendation({
      ...defaultParams,
      onRecommendations,
    });

    expect(mockVerifyRelatedNoteRecommendations).not.toHaveBeenCalled();
    expect(onRecommendations).toHaveBeenCalledWith([]);

    expect(result).toEqual({
      answerGenerationUsage,
      expandedQuery: "expanded related note query",
      notes,
      queryEmbeddingUsage,
      queryExpansionUsage,
      recommendations: [],
    });
  });

  it("Answer와 Verification이 사용한 후보를 Retrieval 정본 candidate index로 저장한다", async () => {
    const FIRST_EMBEDDING_ID = "44444444-4444-4444-8444-444444444444";
    const SECOND_EMBEDDING_ID = "55555555-5555-4555-8555-555555555555";
    const MODEL_ID = "66666666-6666-4666-8666-666666666666";

    const notes = [
      {
        chunkText: "첫 번째 관련 chunk",
        distance: 0.1,
        embeddingId: FIRST_EMBEDDING_ID,
        id: RELATED_NOTE_ID,
        similarity: 0.9,
        title: "Related note",
      },
      {
        chunkText: "두 번째 관련 chunk",
        distance: 0.2,
        embeddingId: SECOND_EMBEDDING_ID,
        id: RELATED_NOTE_ID,
        similarity: 0.8,
        title: "Related note",
      },
    ] as Awaited<ReturnType<typeof prepareRelatedNoteContext>>["notes"];

    const runtimeConfiguration = {
      model: {
        id: MODEL_ID,
        model: "model",
        provider: "openai",
      },
      prompt: {
        agent: {},
        family: {},
        version: {},
      },
      temperature: 0,
    } as never;

    const snapshotAccumulator = createRelatedNotesSnapshotAccumulator({
      content: "Source note content",
      id: TARGET_NOTE_ID,
      title: "Source note",
      updatedAt: "2026-09-05T00:00:00.000Z",
    });

    mockPrepareRelatedNoteContext.mockImplementation(async (params) => {
      params.snapshotAccumulator?.setStage("retrieval", {
        configuration: {
          embeddingModel: {
            dimensions: 1536,
            id: MODEL_ID,
            model: "embedding-model",
            provider: "openai",
          },
          search: {
            inputKind: "rag_note_content",
            limit: 5,
            minSimilarity: 0,
            sourceType: "note",
          },
        },
        hydratedCandidates: notes.map((note) => ({
          chunkText: note.chunkText,
          distance: note.distance,
          embeddingId: note.embeddingId,
          noteId: note.id,
          similarity: note.similarity,
          title: note.title,
        })),
        input: {
          excludeSourceIds: [TARGET_NOTE_ID],
          inputText: "expanded related note query",
        },
        output: {
          context: "<note>Related note</note>",
        },
      });

      return {
        context: "<note>Related note</note>",
        expandedQuery: "expanded related note query",
        notes,
        queryEmbeddingUsage,
        queryExpansionUsage,
      };
    });

    mockGenerateRelatedNoteRecommendations.mockImplementation(
      async (params) => {
        await params.onObservation?.({
          configuration: runtimeConfiguration,
          context: "<note>Related note</note>",
          notes,
          responseFormat: undefined,
          systemPrompt: "answer system",
          type: "prepared",
          userPrompt: "answer user",
          variables: {
            content: "Source note content",
            context: "<note>Related note</note>",
            title: "Source note",
          },
        });

        return {
          recommendations: [
            {
              noteId: RELATED_NOTE_ID,
              reason: "관련 노트 추천 이유",
              title: "Related note",
            },
          ],
          usage: answerGenerationUsage,
        };
      },
    );

    mockVerifyRelatedNoteRecommendations.mockImplementation(async (params) => {
      await params.onObservation?.({
        configuration: runtimeConfiguration,
        context: "verification context",
        notes,
        recommendations: [
          {
            noteId: RELATED_NOTE_ID,
            reason: "관련 노트 추천 이유",
            title: "Related note",
          },
        ],
        responseFormat: undefined,
        systemPrompt: "verification system",
        type: "prepared",
        userPrompt: "verification user",
        variables: {
          content: "Source note content",
          recommendations: "verification context",
          title: "Source note",
        },
      });

      return {
        recommendations: [
          {
            noteId: RELATED_NOTE_ID,
            reason: "관련 노트 추천 이유",
          },
        ],
        usage: verificationUsage,
        verifications: [
          {
            approved: true,
            noteId: RELATED_NOTE_ID,
            reason: "직접적인 학습 관계가 있습니다.",
          },
        ],
      };
    });

    await runRelatedNoteRecommendation({
      ...defaultParams,
      answerConfiguration: runtimeConfiguration,
      snapshotAccumulator,
      verificationConfiguration: runtimeConfiguration,
    });

    const snapshot = snapshotAccumulator.buildSnapshot() as {
      retrieval?: {
        hydratedCandidates?: unknown[];
      };
      answerGeneration?: {
        input?: {
          matchedCandidateIndexes?: number[];
          matchedNotes?: unknown;
        };
      };
      verification?: {
        input?: {
          context?: string;
          matchedCandidateIndexes?: number[];
          matchedNotes?: unknown;
        };
      };
    };

    expect(snapshot.retrieval?.hydratedCandidates).toHaveLength(2);

    expect(snapshot.answerGeneration?.input?.matchedCandidateIndexes).toEqual([
      0, 1,
    ]);

    expect(snapshot.verification?.input?.matchedCandidateIndexes).toEqual([
      0, 1,
    ]);

    expect(snapshot.answerGeneration?.input).not.toHaveProperty("matchedNotes");
    expect(snapshot.verification?.input).not.toHaveProperty("matchedNotes");

    const answerCandidates =
      snapshot.answerGeneration?.input?.matchedCandidateIndexes?.map(
        (index) => snapshot.retrieval?.hydratedCandidates?.[index],
      );

    const verificationCandidates =
      snapshot.verification?.input?.matchedCandidateIndexes?.map(
        (index) => snapshot.retrieval?.hydratedCandidates?.[index],
      );

    expect(answerCandidates).toEqual(snapshot.retrieval?.hydratedCandidates);
    expect(verificationCandidates).toEqual(
      snapshot.retrieval?.hydratedCandidates,
    );

    expect(snapshot.verification?.input?.context).toBe("verification context");
  });
});
