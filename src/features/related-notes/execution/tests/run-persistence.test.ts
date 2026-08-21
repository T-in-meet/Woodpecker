import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  completeRelatedNoteRecommendationRun,
  createRelatedNoteRecommendationRun,
  RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS,
  RELATED_NOTE_RECOMMENDATION_RUN_STATUS,
  saveRelatedNoteRunExpandedQuery,
  saveRelatedNoteRunQueryExpansion,
  saveRelatedNoteRunRecommendations,
} from "../run-persistence";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const createAdminClientMock = vi.mocked(createAdminClient);

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

describe("related note recommendation run persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("running Run을 claim하고 생성된 ID를 반환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          run_id: RUN_ID,
          status: RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS.CLAIMED,
        },
      ],
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      rpc,
    } as never);

    const result = await createRelatedNoteRecommendationRun({
      answerGenerationModelConfigId: "answer-model-config-id",
      embeddingModelConfigId: "embedding-model-config-id",
      noteId: NOTE_ID,
      queryExpansionModelConfigId: "query-expansion-model-config-id",
      sourceUpdatedAt: "2026-08-20T01:00:00.000Z",
      userId: USER_ID,
    });

    expect(rpc).toHaveBeenCalledWith("claim_related_note_recommendation_run", {
      p_answer_generation_model_config_id: "answer-model-config-id",
      p_daily_recommendation_limit: 10,
      p_embedding_model_config_id: "embedding-model-config-id",
      p_note_id: NOTE_ID,
      p_query_expansion_model_config_id: "query-expansion-model-config-id",
      p_source_updated_at: "2026-08-20T01:00:00.000Z",
      p_user_id: USER_ID,
    });
    expect(result).toEqual({
      runId: RUN_ID,
      status: RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS.CLAIMED,
    });
  });

  it("Query Expansion usage와 cost를 저장하고 total cost를 갱신한다", async () => {
    const firstMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: RUN_ID,
        answer_generation_cost_usd: null,
        query_embedding_cost_usd: null,
        query_expansion_cost_usd: 0.00000075,
      },
      error: null,
    });
    const firstSelect = vi.fn().mockReturnValue({
      maybeSingle: firstMaybeSingle,
    });
    const firstEqStatus = vi.fn().mockReturnValue({
      select: firstSelect,
    });
    const firstEqId = vi.fn().mockReturnValue({
      eq: firstEqStatus,
    });
    const firstUpdate = vi.fn().mockReturnValue({
      eq: firstEqId,
    });

    const secondEqStatus = vi.fn().mockResolvedValue({
      error: null,
    });
    const secondEqId = vi.fn().mockReturnValue({
      eq: secondEqStatus,
    });
    const secondUpdate = vi.fn().mockReturnValue({
      eq: secondEqId,
    });

    createAdminClientMock.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce({
          update: firstUpdate,
        })
        .mockReturnValueOnce({
          update: secondUpdate,
        }),
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

    expect(firstUpdate).toHaveBeenCalledWith({
      query_expansion_cost_usd: 7.5e-7,
      query_expansion_usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });

    expect(secondUpdate).toHaveBeenCalledWith({
      total_cost_usd: 0.00000075,
    });
  });

  it("검증된 expanded query를 별도로 저장한다", async () => {
    const firstMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: RUN_ID,
        answer_generation_cost_usd: null,
        query_embedding_cost_usd: null,
        query_expansion_cost_usd: 0.00000075,
      },
      error: null,
    });
    const firstSelect = vi.fn().mockReturnValue({
      maybeSingle: firstMaybeSingle,
    });
    const firstEqStatus = vi.fn().mockReturnValue({
      select: firstSelect,
    });
    const firstEqId = vi.fn().mockReturnValue({
      eq: firstEqStatus,
    });
    const firstUpdate = vi.fn().mockReturnValue({
      eq: firstEqId,
    });

    const secondEqStatus = vi.fn().mockResolvedValue({
      error: null,
    });
    const secondEqId = vi.fn().mockReturnValue({
      eq: secondEqStatus,
    });
    const secondUpdate = vi.fn().mockReturnValue({
      eq: secondEqId,
    });

    createAdminClientMock.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce({
          update: firstUpdate,
        })
        .mockReturnValueOnce({
          update: secondUpdate,
        }),
    } as never);

    await saveRelatedNoteRunExpandedQuery({
      expandedQuery: "expanded query",
      runId: RUN_ID,
    });

    expect(firstUpdate).toHaveBeenCalledWith({
      expanded_query: "expanded query",
    });

    expect(secondUpdate).toHaveBeenCalledWith({
      total_cost_usd: 0.00000075,
    });
  });

  it("추천 결과와 reason을 recommendations JSON snapshot으로 저장한다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: RUN_ID,
        answer_generation_cost_usd: null,
        query_embedding_cost_usd: null,
        query_expansion_cost_usd: null,
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
    const totalEqStatus = vi.fn().mockResolvedValue({
      error: null,
    });
    const totalEqId = vi.fn().mockReturnValue({
      eq: totalEqStatus,
    });
    const totalUpdate = vi.fn().mockReturnValue({
      eq: totalEqId,
    });

    createAdminClientMock.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce({
          update,
        })
        .mockReturnValueOnce({
          update: totalUpdate,
        }),
    } as never);

    await saveRelatedNoteRunRecommendations({
      recommendations: [
        {
          noteId: NOTE_ID,
          reason: "관련 노트 추천 이유",
          title: "Related note",
        },
      ],
      runId: RUN_ID,
    });

    expect(update).toHaveBeenCalledWith({
      recommendations: [
        {
          noteId: NOTE_ID,
          reason: "관련 노트 추천 이유",
          title: "Related note",
        },
      ],
    });
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
