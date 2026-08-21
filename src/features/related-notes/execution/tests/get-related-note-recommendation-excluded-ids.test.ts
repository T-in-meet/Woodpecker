import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { reportRelatedNotesOperationalError } from "../../utils/report-operational-error";
import { getRelatedNoteRecommendationExcludedIds } from "../get-related-note-recommendation-excluded-ids";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("../../utils/report-operational-error", () => ({
  reportRelatedNotesOperationalError: vi.fn(),
}));

const noteId = "11111111-1111-4111-8111-111111111111";
const ownerUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("getRelatedNoteRecommendationExcludedIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(reportRelatedNotesOperationalError).mockResolvedValue(undefined);
  });

  it("소유 Note의 manual 관계와 dismissed AI 관계의 Related Note ID를 반환한다", async () => {
    const relationOrMock = vi.fn().mockResolvedValue({
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

    const relationEqMock = vi.fn().mockReturnValue({
      or: relationOrMock,
    });

    const relationSelectMock = vi.fn().mockReturnValue({
      eq: relationEqMock,
    });

    const noteMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: noteId,
      },
      error: null,
    });

    const noteUserEqMock = vi.fn().mockReturnValue({
      maybeSingle: noteMaybeSingleMock,
    });

    const noteIdEqMock = vi.fn().mockReturnValue({
      eq: noteUserEqMock,
    });

    const noteSelectMock = vi.fn().mockReturnValue({
      eq: noteIdEqMock,
    });

    const fromMock = vi.fn((table: string) => {
      if (table === "notes") {
        return {
          select: noteSelectMock,
        };
      }

      if (table === "note_related_notes") {
        return {
          select: relationSelectMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await getRelatedNoteRecommendationExcludedIds({
      noteId,
      ownerUserId,
    });

    expect(fromMock).toHaveBeenCalledWith("notes");
    expect(noteSelectMock).toHaveBeenCalledWith("id");
    expect(noteIdEqMock).toHaveBeenCalledWith("id", noteId);
    expect(noteUserEqMock).toHaveBeenCalledWith("user_id", ownerUserId);
    expect(noteMaybeSingleMock).toHaveBeenCalledTimes(1);

    expect(fromMock).toHaveBeenCalledWith("note_related_notes");
    expect(relationSelectMock).toHaveBeenCalledWith("related_note_id");
    expect(relationEqMock).toHaveBeenCalledWith("note_id", noteId);
    expect(relationOrMock).toHaveBeenCalledWith(
      "origin.eq.manual,and(origin.eq.ai,status.eq.dismissed)",
    );

    expect(result).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ]);

    expect(reportRelatedNotesOperationalError).not.toHaveBeenCalled();
  });

  it("제외할 기존 관계가 없으면 빈 배열을 반환한다", async () => {
    const relationOrMock = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const relationEqMock = vi.fn().mockReturnValue({
      or: relationOrMock,
    });

    const relationSelectMock = vi.fn().mockReturnValue({
      eq: relationEqMock,
    });

    const noteMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: noteId,
      },
      error: null,
    });

    const noteUserEqMock = vi.fn().mockReturnValue({
      maybeSingle: noteMaybeSingleMock,
    });

    const noteIdEqMock = vi.fn().mockReturnValue({
      eq: noteUserEqMock,
    });

    const noteSelectMock = vi.fn().mockReturnValue({
      eq: noteIdEqMock,
    });

    const fromMock = vi.fn((table: string) => {
      if (table === "notes") {
        return {
          select: noteSelectMock,
        };
      }

      if (table === "note_related_notes") {
        return {
          select: relationSelectMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await getRelatedNoteRecommendationExcludedIds({
      noteId,
      ownerUserId,
    });

    expect(result).toEqual([]);

    expect(reportRelatedNotesOperationalError).not.toHaveBeenCalled();
  });

  it("기준 Note가 사용자 소유가 아니거나 존재하지 않으면 관계를 조회하지 않고 빈 배열을 반환한다", async () => {
    const noteMaybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const noteUserEqMock = vi.fn().mockReturnValue({
      maybeSingle: noteMaybeSingleMock,
    });

    const noteIdEqMock = vi.fn().mockReturnValue({
      eq: noteUserEqMock,
    });

    const noteSelectMock = vi.fn().mockReturnValue({
      eq: noteIdEqMock,
    });

    const fromMock = vi.fn((table: string) => {
      if (table === "notes") {
        return {
          select: noteSelectMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await getRelatedNoteRecommendationExcludedIds({
      noteId,
      ownerUserId,
    });

    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalledWith("note_related_notes");
    expect(reportRelatedNotesOperationalError).not.toHaveBeenCalled();
  });

  it("기준 Note 소유권 조회에 실패하면 운영 오류를 보고하고 오류를 전파한다", async () => {
    const noteError = new Error("note query failed");

    const noteMaybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: noteError,
    });

    const noteUserEqMock = vi.fn().mockReturnValue({
      maybeSingle: noteMaybeSingleMock,
    });

    const noteIdEqMock = vi.fn().mockReturnValue({
      eq: noteUserEqMock,
    });

    const noteSelectMock = vi.fn().mockReturnValue({
      eq: noteIdEqMock,
    });

    const fromMock = vi.fn((table: string) => {
      if (table === "notes") {
        return {
          select: noteSelectMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    await expect(
      getRelatedNoteRecommendationExcludedIds({
        noteId,
        ownerUserId,
      }),
    ).rejects.toThrow("note query failed");

    expect(reportRelatedNotesOperationalError).toHaveBeenCalledWith({
      error: noteError,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXCLUSIONS_LOAD_FAILED,
      message: "Related Note 추천 제외 대상 조회에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RECOMMENDATION_EXCLUSIONS,
      context: {
        noteId,
      },
      userId: ownerUserId,
    });
  });

  it("기존 관계 조회에 실패하면 운영 오류를 보고하고 오류를 전파한다", async () => {
    const relationError = new Error("relation query failed");

    const relationOrMock = vi.fn().mockResolvedValue({
      data: null,
      error: relationError,
    });

    const relationEqMock = vi.fn().mockReturnValue({
      or: relationOrMock,
    });

    const relationSelectMock = vi.fn().mockReturnValue({
      eq: relationEqMock,
    });

    const noteMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: noteId,
      },
      error: null,
    });

    const noteUserEqMock = vi.fn().mockReturnValue({
      maybeSingle: noteMaybeSingleMock,
    });

    const noteIdEqMock = vi.fn().mockReturnValue({
      eq: noteUserEqMock,
    });

    const noteSelectMock = vi.fn().mockReturnValue({
      eq: noteIdEqMock,
    });

    const fromMock = vi.fn((table: string) => {
      if (table === "notes") {
        return {
          select: noteSelectMock,
        };
      }

      if (table === "note_related_notes") {
        return {
          select: relationSelectMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    await expect(
      getRelatedNoteRecommendationExcludedIds({
        noteId,
        ownerUserId,
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
        noteId,
      },
      userId: ownerUserId,
    });
  });
});
