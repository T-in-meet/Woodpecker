import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import { replaceRelatedNoteAiRecommendations } from "../replace-related-note-ai-recommendations";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const createAdminClientMock = vi.mocked(createAdminClient);

describe("replaceRelatedNoteAiRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("관련 노트 추천을 RPC payload로 변환해 교체한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      rpc,
    } as never);

    await replaceRelatedNoteAiRecommendations({
      noteId: "11111111-1111-4111-8111-111111111111",
      recommendations: [
        {
          noteId: "22222222-2222-4222-8222-222222222222",
          title: "Related Note",
          reason: "관련된 내용을 다룹니다.",
          rank: 1,
        },
      ],
    });

    expect(rpc).toHaveBeenCalledWith(
      "replace_note_related_ai_recommendations",
      {
        p_note_id: "11111111-1111-4111-8111-111111111111",
        p_recommendations: [
          {
            relatedNoteId: "22222222-2222-4222-8222-222222222222",
            metadata: {
              title: "Related Note",
              reason: "관련된 내용을 다룹니다.",
              rank: 1,
            },
          },
        ],
      },
    );
  });

  it("추천 결과가 비어 있으면 빈 배열로 AI 추천을 교체한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      rpc,
    } as never);

    await replaceRelatedNoteAiRecommendations({
      noteId: "11111111-1111-4111-8111-111111111111",
      recommendations: [],
    });

    expect(rpc).toHaveBeenCalledWith(
      "replace_note_related_ai_recommendations",
      {
        p_note_id: "11111111-1111-4111-8111-111111111111",
        p_recommendations: [],
      },
    );
  });

  it("RPC 호출에 실패하면 오류를 전달한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: {
        message: "replace failed",
      },
    });

    createAdminClientMock.mockReturnValue({
      rpc,
    } as never);

    await expect(
      replaceRelatedNoteAiRecommendations({
        noteId: "11111111-1111-4111-8111-111111111111",
        recommendations: [],
      }),
    ).rejects.toThrow(
      "Failed to replace related note AI recommendations: replace failed",
    );
  });
});
