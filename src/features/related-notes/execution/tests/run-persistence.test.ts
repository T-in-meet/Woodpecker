import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  completeRelatedNoteRecommendationRun,
  createRelatedNoteRecommendationRunRecord,
  RELATED_NOTE_RECOMMENDATION_RUN_STATUS,
  saveRelatedNoteRunExpandedQuery,
  saveRelatedNoteRunQueryExpansion,
  saveRelatedNoteRunRecommendations,
  saveRelatedNoteRunVerificationResults,
  saveRelatedNoteRunVerificationUsage,
} from "../run-persistence";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const createAdminClientMock = vi.mocked(createAdminClient);

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

/**
 * running Run 단일 UPDATE query chain mock을 생성합니다.
 *
 * @param result UPDATE 이후 select 결과
 * @returns update/select/from 호출 검증에 필요한 mock 묶음
 */
function createRunningRunUpdateMock(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({
    maybeSingle,
  });
  const eqStatus = vi.fn().mockReturnValue({
    select,
  });
  const eqId = vi.fn().mockReturnValue({
    eq: eqStatus,
  });
  const update = vi.fn().mockReturnValue({
    eq: eqId,
  });
  const from = vi.fn().mockReturnValue({
    update,
  });

  return {
    from,
    select,
    update,
  };
}

/**
 * running Run 기록 INSERT query chain mock을 생성합니다.
 *
 * @param result INSERT 이후 select 결과
 * @returns insert/select/from 호출 검증에 필요한 mock 묶음
 */
function createRunRecordInsertMock(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({
    maybeSingle,
  });
  const insert = vi.fn().mockReturnValue({
    select,
  });
  const from = vi.fn().mockReturnValue({
    insert,
  });

  return {
    from,
    insert,
    select,
  };
}

describe("related note recommendation run persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("running Run 기록을 생성하고 ID를 반환한다", async () => {
    const { from, insert, select } = createRunRecordInsertMock({
      data: {
        id: RUN_ID,
      },
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      from,
    } as never);

    const result = await createRelatedNoteRecommendationRunRecord({
      answerGenerationModelConfigId: "answer-model-config-id",
      embeddingModelConfigId: "embedding-model-config-id",
      noteId: NOTE_ID,
      queryExpansionModelConfigId: "query-expansion-model-config-id",
      sourceUpdatedAt: "2026-08-20T01:00:00.000Z",
      userId: USER_ID,
      verificationModelConfigId: "verification-model-config-id",
    });

    expect(from).toHaveBeenCalledWith("related_note_recommendation_runs");
    expect(insert).toHaveBeenCalledWith({
      answer_generation_model_config_id: "answer-model-config-id",
      embedding_model_config_id: "embedding-model-config-id",
      note_id: NOTE_ID,
      query_expansion_model_config_id: "query-expansion-model-config-id",
      source_updated_at: "2026-08-20T01:00:00.000Z",
      status: RELATED_NOTE_RECOMMENDATION_RUN_STATUS.RUNNING,
      user_id: USER_ID,
      verification_model_config_id: "verification-model-config-id",
    });
    expect(select).toHaveBeenCalledWith("id");
    expect(result).toBe(RUN_ID);
  });

  it("Run 기록 생성 실패를 전파한다", async () => {
    const { from } = createRunRecordInsertMock({
      data: null,
      error: {
        message: "insert failed",
      },
    });

    createAdminClientMock.mockReturnValue({
      from,
    } as never);

    await expect(
      createRelatedNoteRecommendationRunRecord({
        answerGenerationModelConfigId: "answer-model-config-id",
        embeddingModelConfigId: "embedding-model-config-id",
        noteId: NOTE_ID,
        queryExpansionModelConfigId: "query-expansion-model-config-id",
        sourceUpdatedAt: "2026-08-20T01:00:00.000Z",
        userId: USER_ID,
        verificationModelConfigId: "verification-model-config-id",
      }),
    ).rejects.toThrow(
      "Failed to create related note recommendation run record: insert failed",
    );
  });

  it("Query Expansion usage와 cost를 저장한다", async () => {
    const { from, select, update } = createRunningRunUpdateMock({
      data: {
        id: RUN_ID,
      },
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      from,
    } as never);

    await saveRelatedNoteRunQueryExpansion({
      modelKey: "openai-gpt-4o-mini",
      runId: RUN_ID,
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });

    expect(update).toHaveBeenCalledWith({
      query_expansion_cost_usd: 7.5e-7,
      query_expansion_usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });
    expect(select).toHaveBeenCalledWith("id");
    expect(from).toHaveBeenCalledOnce();
  });

  it("검증된 expanded query를 별도로 저장한다", async () => {
    const { from, update } = createRunningRunUpdateMock({
      data: {
        id: RUN_ID,
      },
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      from,
    } as never);

    await saveRelatedNoteRunExpandedQuery({
      expandedQuery: "expanded query",
      runId: RUN_ID,
    });

    expect(update).toHaveBeenCalledWith({
      expanded_query: "expanded query",
    });
    expect(from).toHaveBeenCalledOnce();
  });

  it("추천 결과와 reason을 recommendations JSON snapshot으로 저장한다", async () => {
    const { from, update } = createRunningRunUpdateMock({
      data: {
        id: RUN_ID,
      },
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      from,
    } as never);

    await saveRelatedNoteRunRecommendations({
      recommendations: [
        {
          noteId: NOTE_ID,
          reason: "관련 노트 추천 이유",
        },
      ],
      runId: RUN_ID,
    });

    expect(update).toHaveBeenCalledWith({
      recommendations: [
        {
          noteId: NOTE_ID,
          reason: "관련 노트 추천 이유",
        },
      ],
    });
  });

  it("Verification usage와 cost를 저장한다", async () => {
    const { from, update } = createRunningRunUpdateMock({
      data: {
        id: RUN_ID,
      },
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      from,
    } as never);

    await saveRelatedNoteRunVerificationUsage({
      modelKey: "openai-gpt-4o-mini",
      runId: RUN_ID,
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });

    expect(update).toHaveBeenCalledWith({
      verification_cost_usd: 7.5e-7,
      verification_usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });
  });

  it("Verification 결과 snapshot을 저장한다", async () => {
    const { from, update } = createRunningRunUpdateMock({
      data: {
        id: RUN_ID,
      },
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      from,
    } as never);

    await saveRelatedNoteRunVerificationResults({
      runId: RUN_ID,
      verifications: [
        {
          approved: true,
          noteId: NOTE_ID,
          reason: "직접적인 학습 관계입니다.",
        },
      ],
    });

    expect(update).toHaveBeenCalledWith({
      verification_results: [
        {
          approved: true,
          noteId: NOTE_ID,
          reason: "직접적인 학습 관계입니다.",
        },
      ],
    });
  });

  it("갱신 대상 running Run이 없으면 실패한다", async () => {
    const { from } = createRunningRunUpdateMock({
      data: null,
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      from,
    } as never);

    await expect(
      saveRelatedNoteRunExpandedQuery({
        expandedQuery: "expanded query",
        runId: RUN_ID,
      }),
    ).rejects.toThrow(
      `Running related note recommendation run not found: ${RUN_ID}`,
    );
  });

  it("running Run을 최종 상태로 완료한다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: RUN_ID,
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({
      maybeSingle,
    });
    const eqStatus = vi.fn().mockReturnValue({
      select,
    });
    const eqId = vi.fn().mockReturnValue({
      eq: eqStatus,
    });
    const update = vi.fn().mockReturnValue({
      eq: eqId,
    });

    createAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update,
      }),
    } as never);

    await completeRelatedNoteRecommendationRun({
      failureMessage: "failed",
      runId: RUN_ID,
      status: RELATED_NOTE_RECOMMENDATION_RUN_STATUS.FAILED,
    });

    expect(update).toHaveBeenCalledWith({
      completed_at: expect.any(String),
      failure_message: "failed",
      status: RELATED_NOTE_RECOMMENDATION_RUN_STATUS.FAILED,
    });
  });
});
