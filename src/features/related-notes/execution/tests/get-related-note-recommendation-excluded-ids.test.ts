import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { createServerComponentClient } from "@/lib/supabase/server";

import { reportRelatedNotesOperationalError } from "../../utils/report-operational-error";
import { getRelatedNoteRecommendationExcludedIds } from "../get-related-note-recommendation-excluded-ids";

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: vi.fn(),
}));

vi.mock("../../utils/report-operational-error", () => ({
  reportRelatedNotesOperationalError: vi.fn(),
}));

describe("getRelatedNoteRecommendationExcludedIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(reportRelatedNotesOperationalError).mockResolvedValue(undefined);
  });

  it("manual 관계와 dismissed AI 관계의 Related Note ID를 반환한다", async () => {
    const orMock = vi.fn().mockResolvedValue({
      data: [
        {
          related_note_id: "22222222-2222-4222-8222-222222222222",
        },
        {
          related_note_id: "33333333-3333-4333-8333-333333333333",
        },
      ],
      error: null,
    });

    const eqMock = vi.fn().mockReturnValue({
      or: orMock,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    const fromMock = vi.fn().mockReturnValue({
      select: selectMock,
    });

    vi.mocked(createServerComponentClient).mockResolvedValue({
      from: fromMock,
    } as never);

    const result = await getRelatedNoteRecommendationExcludedIds({
      noteId: "11111111-1111-4111-8111-111111111111",
    });

    expect(fromMock).toHaveBeenCalledWith("note_related_notes");

    expect(selectMock).toHaveBeenCalledWith("related_note_id");

    expect(eqMock).toHaveBeenCalledWith(
      "note_id",
      "11111111-1111-4111-8111-111111111111",
    );

    expect(orMock).toHaveBeenCalledWith(
      "origin.eq.manual,and(origin.eq.ai,status.eq.dismissed)",
    );

    expect(result).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ]);

    expect(reportRelatedNotesOperationalError).not.toHaveBeenCalled();
  });

  it("제외할 기존 관계가 없으면 빈 배열을 반환한다", async () => {
    const orMock = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const eqMock = vi.fn().mockReturnValue({
      or: orMock,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    const fromMock = vi.fn().mockReturnValue({
      select: selectMock,
    });

    vi.mocked(createServerComponentClient).mockResolvedValue({
      from: fromMock,
    } as never);

    const result = await getRelatedNoteRecommendationExcludedIds({
      noteId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result).toEqual([]);

    expect(reportRelatedNotesOperationalError).not.toHaveBeenCalled();
  });

  it("기존 관계 조회에 실패하면 운영 오류를 보고하고 오류를 전파한다", async () => {
    const relationError = new Error("relation query failed");

    const orMock = vi.fn().mockResolvedValue({
      data: null,
      error: relationError,
    });

    const eqMock = vi.fn().mockReturnValue({
      or: orMock,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    const fromMock = vi.fn().mockReturnValue({
      select: selectMock,
    });

    vi.mocked(createServerComponentClient).mockResolvedValue({
      from: fromMock,
    } as never);

    await expect(
      getRelatedNoteRecommendationExcludedIds({
        noteId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow("relation query failed");

    expect(reportRelatedNotesOperationalError).toHaveBeenCalledWith({
      error: relationError,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXCLUSIONS_LOAD_FAILED,
      message: "Related Note 추천 제외 대상 조회에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RECOMMENDATION_EXCLUSIONS,
      context: {
        noteId: "11111111-1111-4111-8111-111111111111",
      },
    });
  });
});
