import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import { saveRelatedNoteRecommendations } from "./save-related-note-recommendations";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

/**
 * 관련 노트 추천 저장 테스트용 Supabase mock을 생성합니다.
 *
 * @param input upsert 결과 오류
 * @returns Supabase from/upsert mock
 */
function createSupabaseMock(
  input: { error?: { message: string } | null } = {},
) {
  const upsert = vi.fn().mockResolvedValue({ error: input.error ?? null });
  const from = vi.fn().mockReturnValue({ upsert });

  return { from, upsert };
}

describe("saveRelatedNoteRecommendations", () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReset();
  });

  it("대상 Note ID 기준으로 추천 결과를 upsert한다", async () => {
    const supabase = createSupabaseMock();
    vi.mocked(createAdminClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createAdminClient>,
    );

    await saveRelatedNoteRecommendations({
      noteId: "11111111-1111-4111-8111-111111111111",
      recommendations: [
        {
          noteId: "22222222-2222-4222-8222-222222222222",
          title: "관련 노트",
        },
      ],
    });

    expect(supabase.from).toHaveBeenCalledWith("note_related_recommendations");
    expect(supabase.upsert).toHaveBeenCalledWith(
      {
        note_id: "11111111-1111-4111-8111-111111111111",
        recommendations: [
          {
            noteId: "22222222-2222-4222-8222-222222222222",
            title: "관련 노트",
          },
        ],
      },
      { onConflict: "note_id" },
    );
  });

  it("저장 실패 시 오류를 던진다", async () => {
    const supabase = createSupabaseMock({
      error: { message: "upsert failed" },
    });
    vi.mocked(createAdminClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createAdminClient>,
    );

    await expect(
      saveRelatedNoteRecommendations({
        noteId: "11111111-1111-4111-8111-111111111111",
        recommendations: [],
      }),
    ).rejects.toThrow(
      "Failed to save related note recommendations: upsert failed",
    );
  });
});
