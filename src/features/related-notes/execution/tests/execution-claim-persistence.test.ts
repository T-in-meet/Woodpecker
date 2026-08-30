import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import { RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE } from "../../constants/ai";
import {
  claimRelatedNoteRecommendationExecution,
  completeRelatedNoteRecommendationExecutionClaim,
  RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS,
  RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS,
} from "../execution-claim-persistence";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const createAdminClientMock = vi.mocked(createAdminClient);

const CLAIM_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const SOURCE_UPDATED_AT = "2026-08-20T01:00:00.000Z";

describe("related note recommendation execution claim persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("추천 실행 claim을 생성하고 claim ID를 반환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          claim_id: CLAIM_ID,
          status: RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.CLAIMED,
        },
      ],
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      rpc,
    } as never);

    const result = await claimRelatedNoteRecommendationExecution({
      noteId: NOTE_ID,
      sourceUpdatedAt: SOURCE_UPDATED_AT,
      userId: USER_ID,
    });

    expect(rpc).toHaveBeenCalledWith(
      "claim_related_note_recommendation_execution",
      {
        p_daily_recommendation_limit:
          RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
        p_note_id: NOTE_ID,
        p_source_updated_at: SOURCE_UPDATED_AT,
        p_user_id: USER_ID,
      },
    );

    expect(result).toEqual({
      claimId: CLAIM_ID,
      status: RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.CLAIMED,
    });
  });

  it("stale claim 결과는 null claim ID와 함께 반환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          claim_id: null,
          status: RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.STALE,
        },
      ],
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      rpc,
    } as never);

    await expect(
      claimRelatedNoteRecommendationExecution({
        noteId: NOTE_ID,
        sourceUpdatedAt: SOURCE_UPDATED_AT,
        userId: USER_ID,
      }),
    ).resolves.toEqual({
      claimId: null,
      status: RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.STALE,
    });
  });

  it("claimed 결과에 claim ID가 없으면 실패한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          claim_id: null,
          status: RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.CLAIMED,
        },
      ],
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      rpc,
    } as never);

    await expect(
      claimRelatedNoteRecommendationExecution({
        noteId: NOTE_ID,
        sourceUpdatedAt: SOURCE_UPDATED_AT,
        userId: USER_ID,
      }),
    ).rejects.toThrow(
      "Related note recommendation execution claim returned no claim ID.",
    );
  });

  it("추천 실행 claim을 완료한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: CLAIM_ID,
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      rpc,
    } as never);

    await completeRelatedNoteRecommendationExecutionClaim({
      claimId: CLAIM_ID,
      status:
        RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS.SUCCEEDED,
    });

    expect(rpc).toHaveBeenCalledWith(
      "complete_related_note_recommendation_execution_claim",
      {
        p_claim_id: CLAIM_ID,
        p_status:
          RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS.SUCCEEDED,
      },
    );
  });
});
