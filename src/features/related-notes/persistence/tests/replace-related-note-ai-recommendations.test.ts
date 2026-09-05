import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import { replaceRelatedNoteAiRecommendations } from "../replace-related-note-ai-recommendations";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const createAdminClientMock = vi.mocked(createAdminClient);

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RELATED_NOTE_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_UPDATED_AT = "2026-08-20T01:00:00.000Z";

describe("replaceRelatedNoteAiRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("관련 노트 추천과 source updated_at을 RPC payload로 변환해 교체한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "replaced", relationIds: [RELATED_NOTE_ID] },
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      rpc,
    } as never);

    const result = await replaceRelatedNoteAiRecommendations({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
      recommendations: [
        {
          noteId: RELATED_NOTE_ID,
          reason: "관련된 내용을 다룹니다.",
        },
      ],
      sourceUpdatedAt: SOURCE_UPDATED_AT,
    });

    expect(rpc).toHaveBeenCalledWith(
      "replace_note_related_ai_recommendations",
      {
        p_note_id: NOTE_ID,
        p_owner_user_id: OWNER_USER_ID,
        p_recommendations: [
          {
            relatedNoteId: RELATED_NOTE_ID,
            metadata: {
              reason: "관련된 내용을 다룹니다.",
            },
          },
        ],
        p_source_updated_at: SOURCE_UPDATED_AT,
      },
    );

    expect(result).toEqual({
      status: "replaced",
      relationIds: [RELATED_NOTE_ID],
    });
  });

  it("추천 결과가 비어 있으면 빈 배열로 AI 추천을 교체한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "stale", relationIds: [] },
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      rpc,
    } as never);

    const result = await replaceRelatedNoteAiRecommendations({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
      recommendations: [],
      sourceUpdatedAt: SOURCE_UPDATED_AT,
    });

    expect(rpc).toHaveBeenCalledWith(
      "replace_note_related_ai_recommendations",
      {
        p_note_id: NOTE_ID,
        p_owner_user_id: OWNER_USER_ID,
        p_recommendations: [],
        p_source_updated_at: SOURCE_UPDATED_AT,
      },
    );

    expect(result).toEqual({ status: "stale", relationIds: [] });
  });

  it("RPC 호출에 실패하면 오류를 전달한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "replace failed",
      },
    });

    createAdminClientMock.mockReturnValue({
      rpc,
    } as never);

    await expect(
      replaceRelatedNoteAiRecommendations({
        noteId: NOTE_ID,
        ownerUserId: OWNER_USER_ID,
        recommendations: [],
        sourceUpdatedAt: SOURCE_UPDATED_AT,
      }),
    ).rejects.toThrow(
      "Failed to replace related note AI recommendations: replace failed",
    );
  });
});
