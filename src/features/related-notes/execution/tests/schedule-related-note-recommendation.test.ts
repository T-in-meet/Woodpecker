import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOTE_RETRIEVAL_AI_FEATURE_KEY,
  NOTE_RETRIEVAL_AI_ROLE_KEY,
} from "@/features/ai/rags/note/constants/runtime";
import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes";
import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  RELATED_NOTES_MIN_SIMILARITY,
  RELATED_NOTES_SEARCH_LIMIT,
} from "../../constants/ai";
import { replaceRelatedNoteAiRecommendations } from "../../persistence/replace-related-note-ai-recommendations";
import { reportRelatedNotesOperationalError } from "../../utils/report-operational-error";
import {
  completeRelatedNoteRecommendationRun,
  createRelatedNoteRecommendationRun,
  RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS,
  RELATED_NOTE_RECOMMENDATION_RUN_STATUS,
  RelatedNoteRecommendationDailyLimitError,
  saveRelatedNoteRunAnswerGenerationUsage,
  saveRelatedNoteRunExpandedQuery,
  saveRelatedNoteRunMatchedNotes,
  saveRelatedNoteRunQueryEmbedding,
  saveRelatedNoteRunQueryExpansion,
  saveRelatedNoteRunRecommendations,
} from "../run-persistence";
import { runRelatedNoteRecommendation } from "../run-related-note-recommendation";
import { scheduleRelatedNoteRecommendation } from "../schedule-related-note-recommendation";

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => Promise<void>) => callback()),
}));

vi.mock("@/features/ai/runtimes", () => ({
  resolveAiRuntimeChatConfiguration: vi.fn(),
  resolveAiRuntimeEmbeddingConfiguration: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("../../persistence/replace-related-note-ai-recommendations", () => ({
  REPLACE_RELATED_NOTE_AI_RECOMMENDATIONS_STATUS: {
    REPLACED: "replaced",
    SOURCE_NOT_FOUND: "source_not_found",
    STALE: "stale",
  },
  replaceRelatedNoteAiRecommendations: vi.fn(),
}));

vi.mock("../../utils/report-operational-error", () => ({
  reportRelatedNotesOperationalError: vi.fn(),
}));

vi.mock("../run-related-note-recommendation", () => ({
  runRelatedNoteRecommendation: vi.fn(),
}));

vi.mock("../run-persistence", () => ({
  RelatedNoteRecommendationDailyLimitError: class RelatedNoteRecommendationDailyLimitError extends Error {
    constructor() {
      super("Related Notes daily recommendation limit exceeded.");
      this.name = "RelatedNoteRecommendationDailyLimitError";
    }
  },
  RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS: {
    CLAIMED: "claimed",
    DUPLICATE: "duplicate",
  },
  RELATED_NOTE_RECOMMENDATION_RUN_STATUS: {
    RUNNING: "running",
    SUCCEEDED: "succeeded",
    FAILED: "failed",
    STALE: "stale",
  },
  RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP: {
    ANSWER_GENERATION: "answer_generation",
    QUERY_EXPANSION: "query_expansion",
    QUERY_EMBEDDING: "query_embedding",
    MATCHED_NOTES: "matched_notes",
    RECOMMENDATIONS: "recommendations",
  },
  completeRelatedNoteRecommendationRun: vi.fn(),
  createRelatedNoteRecommendationRun: vi.fn(),
  saveRelatedNoteRunAnswerGenerationUsage: vi.fn(),
  saveRelatedNoteRunExpandedQuery: vi.fn(),
  saveRelatedNoteRunMatchedNotes: vi.fn(),
  saveRelatedNoteRunQueryEmbedding: vi.fn(),
  saveRelatedNoteRunQueryExpansion: vi.fn(),
  saveRelatedNoteRunRecommendations: vi.fn(),
}));

const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockResolveAiRuntimeChatConfiguration = vi.mocked(
  resolveAiRuntimeChatConfiguration,
);
const mockResolveAiRuntimeEmbeddingConfiguration = vi.mocked(
  resolveAiRuntimeEmbeddingConfiguration,
);
const mockRunRelatedNoteRecommendation = vi.mocked(
  runRelatedNoteRecommendation,
);
const mockReplaceRelatedNoteAiRecommendations = vi.mocked(
  replaceRelatedNoteAiRecommendations,
);
const mockReportRelatedNotesOperationalError = vi.mocked(
  reportRelatedNotesOperationalError,
);
const mockCreateRelatedNoteRecommendationRun = vi.mocked(
  createRelatedNoteRecommendationRun,
);
const mockCompleteRelatedNoteRecommendationRun = vi.mocked(
  completeRelatedNoteRecommendationRun,
);
const mockSaveRelatedNoteRunQueryExpansion = vi.mocked(
  saveRelatedNoteRunQueryExpansion,
);
const mockSaveRelatedNoteRunExpandedQuery = vi.mocked(
  saveRelatedNoteRunExpandedQuery,
);
const mockSaveRelatedNoteRunQueryEmbedding = vi.mocked(
  saveRelatedNoteRunQueryEmbedding,
);
const mockSaveRelatedNoteRunMatchedNotes = vi.mocked(
  saveRelatedNoteRunMatchedNotes,
);
const mockSaveRelatedNoteRunAnswerGenerationUsage = vi.mocked(
  saveRelatedNoteRunAnswerGenerationUsage,
);
const mockSaveRelatedNoteRunRecommendations = vi.mocked(
  saveRelatedNoteRunRecommendations,
);

const OWNER_USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";
const RELATED_NOTE_ID = "33333333-3333-4333-8333-333333333333";
const SOURCE_UPDATED_AT = "2026-08-20T01:00:00.000Z";
const RUN_ID = "44444444-4444-4444-8444-444444444444";

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

const recommendations = [
  {
    noteId: RELATED_NOTE_ID,
    reason: "관련 노트 추천 이유",
    title: "Related note",
  },
];

const embeddingConfiguration = {
  model: {
    id: "embedding-model-config-id",
    provider: "openai",
    model: "text-embedding-3-small",
  },
} as Awaited<ReturnType<typeof resolveAiRuntimeEmbeddingConfiguration>>;

const queryExpansionConfiguration = {
  model: {
    id: "query-expansion-model-config-id",
    provider: "openai",
    model: "gpt-4o-mini",
  },
} as Awaited<ReturnType<typeof resolveAiRuntimeChatConfiguration>>;

const answerConfiguration = {
  model: {
    id: "answer-model-config-id",
    provider: "openai",
    model: "gpt-4o-mini",
  },
} as Awaited<ReturnType<typeof resolveAiRuntimeChatConfiguration>>;

/**
 * scheduleRelatedNoteRecommendation에서 사용하는
 * notes 조회 체인만 최소한으로 구현한 Supabase Admin Client mock을 생성합니다.
 *
 * 실제 SupabaseClient의 전체 API를 테스트할 필요는 없으므로,
 * 필요한 query chain만 구성한 뒤 createAdminClient의 반환 타입으로 맞춥니다.
 */
function createNotesQueryMock({
  data,
  error,
}: {
  data: unknown;
  error: unknown;
}): ReturnType<typeof createAdminClient> {
  const maybeSingle = vi.fn().mockResolvedValue({
    data,
    error,
  });

  const eqUserId = vi.fn().mockReturnValue({
    maybeSingle,
  });

  const eqNoteId = vi.fn().mockReturnValue({
    eq: eqUserId,
  });

  const select = vi.fn().mockReturnValue({
    eq: eqNoteId,
  });

  return {
    from: vi.fn().mockReturnValue({
      select,
    }),
  } as unknown as ReturnType<typeof createAdminClient>;
}

/**
 * 정상적인 Related Notes 추천 실행 결과 mock을 설정합니다.
 */
function mockSuccessfulRecommendationRun() {
  mockRunRelatedNoteRecommendation.mockResolvedValue({
    answerGenerationUsage,
    expandedQuery: "expanded query",
    notes: [],
    queryEmbeddingUsage,
    queryExpansionUsage,
    recommendations,
  });
}

describe("scheduleRelatedNoteRecommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockReportRelatedNotesOperationalError.mockResolvedValue(undefined);

    mockResolveAiRuntimeEmbeddingConfiguration.mockResolvedValue(
      embeddingConfiguration,
    );

    mockResolveAiRuntimeChatConfiguration
      .mockResolvedValueOnce(queryExpansionConfiguration)
      .mockResolvedValueOnce(answerConfiguration);

    mockCreateRelatedNoteRecommendationRun.mockResolvedValue({
      runId: RUN_ID,
      status: RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS.CLAIMED,
    });
    mockCompleteRelatedNoteRecommendationRun.mockResolvedValue(undefined);
    mockSaveRelatedNoteRunAnswerGenerationUsage.mockResolvedValue(undefined);
    mockSaveRelatedNoteRunExpandedQuery.mockResolvedValue(undefined);
    mockSaveRelatedNoteRunMatchedNotes.mockResolvedValue(undefined);
    mockSaveRelatedNoteRunQueryEmbedding.mockResolvedValue(undefined);
    mockSaveRelatedNoteRunQueryExpansion.mockResolvedValue(undefined);
    mockSaveRelatedNoteRunRecommendations.mockResolvedValue(undefined);
    mockReplaceRelatedNoteAiRecommendations.mockResolvedValue("replaced");
  });

  it("최신 Note snapshot으로 추천을 실행하고 sourceUpdatedAt과 함께 저장한다", async () => {
    const supabase = createNotesQueryMock({
      data: {
        id: NOTE_ID,
        title: "Source note",
        content: "Source note content",
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });

    mockCreateAdminClient.mockReturnValue(supabase);
    mockSuccessfulRecommendationRun();

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockRunRelatedNoteRecommendation).toHaveBeenCalledWith(
        expect.objectContaining({
          answerConfiguration,
          content: "Source note content",
          embeddingConfiguration,
          limit: RELATED_NOTES_SEARCH_LIMIT,
          minSimilarity: RELATED_NOTES_MIN_SIMILARITY,
          onAnswerGenerationUsage: expect.any(Function),
          onExpandedQuery: expect.any(Function),
          onMatchedNotes: expect.any(Function),
          onQueryEmbeddingUsage: expect.any(Function),
          onQueryExpansionUsage: expect.any(Function),
          onRecommendations: expect.any(Function),
          ownerUserId: OWNER_USER_ID,
          queryExpansionConfiguration,
          targetNoteId: NOTE_ID,
          title: "Source note",
        }),
      );
    });

    expect(mockCreateRelatedNoteRecommendationRun).toHaveBeenCalledWith({
      answerGenerationModelConfigId: "answer-model-config-id",
      embeddingModelConfigId: "embedding-model-config-id",
      noteId: NOTE_ID,
      queryExpansionModelConfigId: "query-expansion-model-config-id",
      sourceUpdatedAt: SOURCE_UPDATED_AT,
      userId: OWNER_USER_ID,
    });

    expect(mockReplaceRelatedNoteAiRecommendations).toHaveBeenCalledWith({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
      recommendations,
      sourceUpdatedAt: SOURCE_UPDATED_AT,
    });

    expect(mockResolveAiRuntimeEmbeddingConfiguration).toHaveBeenCalledWith({
      featureKey: NOTE_RETRIEVAL_AI_FEATURE_KEY,
      roleKey: NOTE_RETRIEVAL_AI_ROLE_KEY,
    });

    expect(mockResolveAiRuntimeChatConfiguration).toHaveBeenNthCalledWith(1, {
      featureKey: "related-notes",
      roleKey: "query-expansion",
    });

    expect(mockResolveAiRuntimeChatConfiguration).toHaveBeenNthCalledWith(2, {
      featureKey: "related-notes",
      roleKey: "answer-generation",
    });

    expect(mockCompleteRelatedNoteRecommendationRun).toHaveBeenCalledWith({
      runId: RUN_ID,
      status: RELATED_NOTE_RECOMMENDATION_RUN_STATUS.SUCCEEDED,
    });
  });

  it("추천 저장에 실패하면 운영 오류를 보고하고 Run을 failed로 완료한다", async () => {
    const supabase = createNotesQueryMock({
      data: {
        id: NOTE_ID,
        title: "Source note",
        content: "Source note content",
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });

    const replaceError = new Error("replace failed");

    mockCreateAdminClient.mockReturnValue(supabase);
    mockSuccessfulRecommendationRun();
    mockReplaceRelatedNoteAiRecommendations.mockRejectedValue(replaceError);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockReportRelatedNotesOperationalError).toHaveBeenCalledWith({
        error: replaceError,
        errorCode:
          RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATIONS_REPLACE_FAILED,
        message: "Related Note AI 추천 교체에 실패했습니다.",
        operation:
          RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.REPLACE_RECOMMENDATIONS,
        context: {
          noteId: NOTE_ID,
        },
        userId: OWNER_USER_ID,
      });
    });

    expect(mockCompleteRelatedNoteRecommendationRun).toHaveBeenCalledWith({
      failureMessage: "replace failed",
      runId: RUN_ID,
      status: RELATED_NOTE_RECOMMENDATION_RUN_STATUS.FAILED,
    });

    consoleErrorSpy.mockRestore();
  });

  it("추천 실행 callback을 통해 usage와 snapshot을 Run에 저장한다", async () => {
    const supabase = createNotesQueryMock({
      data: {
        id: NOTE_ID,
        title: "Source note",
        content: "Source note content",
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });

    mockCreateAdminClient.mockReturnValue(supabase);

    mockRunRelatedNoteRecommendation.mockImplementation(async (params) => {
      /*
       * Provider 호출 직후 Query Expansion usage가 먼저 전달되고,
       * 파싱/검증을 통과한 expanded query가 별도 callback으로 전달됩니다.
       */
      await params.onQueryExpansionUsage?.(queryExpansionUsage);
      await params.onExpandedQuery?.("expanded query");

      await params.onQueryEmbeddingUsage?.(queryEmbeddingUsage);
      await params.onMatchedNotes?.([RELATED_NOTE_ID]);
      await params.onAnswerGenerationUsage?.(answerGenerationUsage);
      await params.onRecommendations?.(recommendations);

      return {
        answerGenerationUsage,
        expandedQuery: "expanded query",
        notes: [],
        queryEmbeddingUsage,
        queryExpansionUsage,
        recommendations,
      };
    });

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockSaveRelatedNoteRunQueryExpansion).toHaveBeenCalledWith({
        modelKey: "openai-gpt-4o-mini",
        runId: RUN_ID,
        usage: queryExpansionUsage,
      });
    });

    /*
     * Query Expansion usage/cost는 Provider usage callback에서 한 번만 저장합니다.
     */
    expect(mockSaveRelatedNoteRunQueryExpansion).toHaveBeenCalledOnce();

    expect(mockSaveRelatedNoteRunExpandedQuery).toHaveBeenCalledWith({
      expandedQuery: "expanded query",
      runId: RUN_ID,
    });

    expect(mockSaveRelatedNoteRunExpandedQuery).toHaveBeenCalledOnce();

    expect(mockSaveRelatedNoteRunQueryEmbedding).toHaveBeenCalledWith({
      modelKey: "openai-text-embedding-3-small",
      runId: RUN_ID,
      usage: queryEmbeddingUsage,
    });

    expect(mockSaveRelatedNoteRunMatchedNotes).toHaveBeenCalledWith({
      matchedNoteIds: [RELATED_NOTE_ID],
      runId: RUN_ID,
    });

    expect(mockSaveRelatedNoteRunAnswerGenerationUsage).toHaveBeenCalledWith({
      modelKey: "openai-gpt-4o-mini",
      runId: RUN_ID,
      usage: answerGenerationUsage,
    });

    expect(mockSaveRelatedNoteRunRecommendations).toHaveBeenCalledWith({
      recommendations,
      runId: RUN_ID,
    });
  });

  it("Run claim에 실패하면 운영 오류를 보고하고 추천 실행을 중단한다", async () => {
    const supabase = createNotesQueryMock({
      data: {
        id: NOTE_ID,
        title: "Source note",
        content: "Source note content",
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });

    const runCreateError = new Error("run create failed");

    mockCreateAdminClient.mockReturnValue(supabase);
    mockCreateRelatedNoteRecommendationRun.mockRejectedValue(runCreateError);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockReportRelatedNotesOperationalError).toHaveBeenCalledWith({
        error: runCreateError,
        errorCode:
          RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_RUN_CREATE_FAILED,
        message: "Related Note 추천 실행 이력 생성에 실패했습니다.",
        operation:
          RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.CREATE_RECOMMENDATION_RUN,
        context: {
          noteId: NOTE_ID,
        },
        userId: OWNER_USER_ID,
      });
    });

    expect(mockRunRelatedNoteRecommendation).not.toHaveBeenCalled();
    expect(mockReplaceRelatedNoteAiRecommendations).not.toHaveBeenCalled();

    /*
     * Run이 claim되지 않았으므로 usage/snapshot/완료 기록은 수행하지 않습니다.
     */
    expect(mockSaveRelatedNoteRunQueryExpansion).not.toHaveBeenCalled();
    expect(mockSaveRelatedNoteRunExpandedQuery).not.toHaveBeenCalled();
    expect(mockSaveRelatedNoteRunQueryEmbedding).not.toHaveBeenCalled();
    expect(mockSaveRelatedNoteRunMatchedNotes).not.toHaveBeenCalled();
    expect(mockSaveRelatedNoteRunAnswerGenerationUsage).not.toHaveBeenCalled();
    expect(mockSaveRelatedNoteRunRecommendations).not.toHaveBeenCalled();
    expect(mockCompleteRelatedNoteRecommendationRun).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("동일 Note version 실행이 이미 claim되어 있으면 추천 실행을 건너뛴다", async () => {
    const supabase = createNotesQueryMock({
      data: {
        id: NOTE_ID,
        title: "Source note",
        content: "Source note content",
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });

    mockCreateAdminClient.mockReturnValue(supabase);
    mockCreateRelatedNoteRecommendationRun.mockResolvedValue({
      runId: RUN_ID,
      status: RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS.DUPLICATE,
    });

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockCreateRelatedNoteRecommendationRun).toHaveBeenCalledOnce();
    });

    expect(mockRunRelatedNoteRecommendation).not.toHaveBeenCalled();
    expect(mockReplaceRelatedNoteAiRecommendations).not.toHaveBeenCalled();
    expect(mockCompleteRelatedNoteRecommendationRun).not.toHaveBeenCalled();
  });

  it("일일 추천 제한에 도달하면 추천 실행을 건너뛴다", async () => {
    const supabase = createNotesQueryMock({
      data: {
        id: NOTE_ID,
        title: "Source note",
        content: "Source note content",
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });

    const consoleInfoSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    mockCreateAdminClient.mockReturnValue(supabase);
    mockCreateRelatedNoteRecommendationRun.mockRejectedValue(
      new RelatedNoteRecommendationDailyLimitError(),
    );

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockCreateRelatedNoteRecommendationRun).toHaveBeenCalledOnce();
    });

    expect(mockReportRelatedNotesOperationalError).not.toHaveBeenCalled();
    expect(mockRunRelatedNoteRecommendation).not.toHaveBeenCalled();
    expect(mockReplaceRelatedNoteAiRecommendations).not.toHaveBeenCalled();
    expect(mockCompleteRelatedNoteRecommendationRun).not.toHaveBeenCalled();

    consoleInfoSpy.mockRestore();
  });

  it("Run 갱신에 실패해도 추천 실행과 저장을 계속하고 운영 오류를 보고한다", async () => {
    const supabase = createNotesQueryMock({
      data: {
        id: NOTE_ID,
        title: "Source note",
        content: "Source note content",
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });

    const runUpdateError = new Error("run update failed");

    mockCreateAdminClient.mockReturnValue(supabase);

    mockSaveRelatedNoteRunQueryEmbedding.mockRejectedValue(runUpdateError);

    mockRunRelatedNoteRecommendation.mockImplementation(async (params) => {
      await params.onQueryEmbeddingUsage?.(queryEmbeddingUsage);

      return {
        answerGenerationUsage,
        expandedQuery: "expanded query",
        notes: [],
        queryEmbeddingUsage,
        queryExpansionUsage,
        recommendations,
      };
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockReplaceRelatedNoteAiRecommendations).toHaveBeenCalledWith({
        noteId: NOTE_ID,
        ownerUserId: OWNER_USER_ID,
        recommendations,
        sourceUpdatedAt: SOURCE_UPDATED_AT,
      });
    });

    expect(mockReportRelatedNotesOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: runUpdateError,
        errorCode:
          RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_RUN_UPDATE_FAILED,
        message: "Related Note 추천 실행 이력 갱신에 실패했습니다.",
        operation:
          RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.UPDATE_RECOMMENDATION_RUN,
        userId: OWNER_USER_ID,
      }),
    );

    expect(mockCompleteRelatedNoteRecommendationRun).toHaveBeenCalledWith({
      runId: RUN_ID,
      status: RELATED_NOTE_RECOMMENDATION_RUN_STATUS.SUCCEEDED,
    });

    consoleErrorSpy.mockRestore();
  });

  it("Answer Generation usage 저장 실패를 전용 step으로 보고한다", async () => {
    const supabase = createNotesQueryMock({
      data: {
        id: NOTE_ID,
        title: "Source note",
        content: "Source note content",
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });

    const runUpdateError = new Error("answer generation usage update failed");

    mockCreateAdminClient.mockReturnValue(supabase);
    mockSaveRelatedNoteRunAnswerGenerationUsage.mockRejectedValue(
      runUpdateError,
    );

    mockRunRelatedNoteRecommendation.mockImplementation(async (params) => {
      await params.onAnswerGenerationUsage?.(answerGenerationUsage);

      return {
        answerGenerationUsage,
        expandedQuery: "expanded query",
        notes: [],
        queryEmbeddingUsage,
        queryExpansionUsage,
        recommendations,
      };
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockReportRelatedNotesOperationalError).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            noteId: NOTE_ID,
            runId: RUN_ID,
            runStatus: "running",
            runUpdateStep: "answer_generation",
          },
          error: runUpdateError,
          errorCode:
            RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_RUN_UPDATE_FAILED,
          operation:
            RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.UPDATE_RECOMMENDATION_RUN,
        }),
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("Run 완료에 실패해도 이미 저장된 추천 결과에는 영향을 주지 않는다", async () => {
    const supabase = createNotesQueryMock({
      data: {
        id: NOTE_ID,
        title: "Source note",
        content: "Source note content",
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });

    const runCompleteError = new Error("run complete failed");

    mockCreateAdminClient.mockReturnValue(supabase);
    mockSuccessfulRecommendationRun();
    mockCompleteRelatedNoteRecommendationRun.mockRejectedValue(
      runCompleteError,
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockReplaceRelatedNoteAiRecommendations).toHaveBeenCalledOnce();
    });

    expect(mockReportRelatedNotesOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: runCompleteError,
        errorCode:
          RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_RUN_COMPLETE_FAILED,
        message: "Related Note 추천 실행 이력 완료 처리에 실패했습니다.",
        operation:
          RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_RECOMMENDATION_RUN,
        userId: OWNER_USER_ID,
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  it("추천 실행 실패 시 Run을 failed로 완료한다", async () => {
    const supabase = createNotesQueryMock({
      data: {
        id: NOTE_ID,
        title: "Source note",
        content: "Source note content",
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });

    const executionError = new Error("execution failed");

    mockCreateAdminClient.mockReturnValue(supabase);
    mockRunRelatedNoteRecommendation.mockRejectedValue(executionError);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockCompleteRelatedNoteRecommendationRun).toHaveBeenCalledWith({
        failureMessage: "execution failed",
        runId: RUN_ID,
        status: RELATED_NOTE_RECOMMENDATION_RUN_STATUS.FAILED,
      });
    });

    consoleErrorSpy.mockRestore();
  });

  it("Note가 존재하지 않으면 추천을 실행하지 않는다", async () => {
    const supabase = createNotesQueryMock({
      data: null,
      error: null,
    });

    mockCreateAdminClient.mockReturnValue(supabase);

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockRunRelatedNoteRecommendation).not.toHaveBeenCalled();
    });

    expect(mockReplaceRelatedNoteAiRecommendations).not.toHaveBeenCalled();
    expect(mockReportRelatedNotesOperationalError).not.toHaveBeenCalled();
  });

  it("Note 조회에 실패하면 추천을 실행하지 않는다", async () => {
    const sourceLoadError = {
      message: "Failed to load note",
    };

    const supabase = createNotesQueryMock({
      data: null,
      error: sourceLoadError,
    });

    mockCreateAdminClient.mockReturnValue(supabase);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockRunRelatedNoteRecommendation).not.toHaveBeenCalled();
    });

    expect(mockReplaceRelatedNoteAiRecommendations).not.toHaveBeenCalled();

    expect(mockReportRelatedNotesOperationalError).toHaveBeenCalledWith({
      error: sourceLoadError,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_SOURCE_LOAD_FAILED,
      message: "Related Note 추천을 위한 Note source 조회에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RECOMMENDATION_SOURCE,
      context: {
        noteId: NOTE_ID,
      },
      userId: OWNER_USER_ID,
    });

    consoleErrorSpy.mockRestore();
  });
});
