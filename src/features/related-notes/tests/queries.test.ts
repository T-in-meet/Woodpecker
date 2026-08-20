import { beforeEach, describe, expect, it, vi } from "vitest";

import { logError } from "@/lib/logger";
import { createServerComponentClient } from "@/lib/supabase/server";
import { createSupabaseQueryMock } from "@/tests/supabaseQueryMock";

import { getRelatedNoteCandidates, getRelatedNotes } from "../queries";

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

const createClientMock = vi.mocked(createServerComponentClient);
const logErrorMock = vi.mocked(logError);

describe("getRelatedNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("active 관련 노트를 조회해 화면 표시 형식으로 반환한다", async () => {
    const { supabase, callsFor } = createSupabaseQueryMock({
      note_related_notes: {
        data: [
          {
            related_note_id: "22222222-2222-4222-8222-222222222222",
            origin: "ai",
            metadata: {
              title: "관련 노트",
              reason: "비슷한 내용을 다룹니다.",
              rank: 1,
            },
          },
          {
            related_note_id: "33333333-3333-4333-8333-333333333333",
            origin: "manual",
            metadata: {
              title: "직접 연결한 노트",
            },
          },
        ],
      },
    });

    createClientMock.mockResolvedValue(supabase as never);

    const result = await getRelatedNotes(
      "11111111-1111-4111-8111-111111111111",
    );

    const calls = callsFor("note_related_notes");

    expect(calls).toContainEqual([
      "select",
      ["related_note_id, origin, metadata"],
    ]);
    expect(calls).toContainEqual([
      "eq",
      ["note_id", "11111111-1111-4111-8111-111111111111"],
    ]);
    expect(calls).toContainEqual(["eq", ["status", "active"]]);

    expect(result).toStrictEqual([
      {
        noteId: "22222222-2222-4222-8222-222222222222",
        origin: "ai",
        title: "관련 노트",
        reason: "비슷한 내용을 다룹니다.",
        rank: 1,
      },
      {
        noteId: "33333333-3333-4333-8333-333333333333",
        origin: "manual",
        title: "직접 연결한 노트",
      },
    ]);
  });

  it("조회에 실패하면 오류를 기록하고 빈 배열을 반환한다", async () => {
    const dbError = new Error("related notes query failed");

    const { supabase } = createSupabaseQueryMock({
      note_related_notes: {
        data: null,
        error: dbError,
      },
    });

    createClientMock.mockResolvedValue(supabase as never);

    const result = await getRelatedNotes(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result).toEqual([]);
    expect(logErrorMock).toHaveBeenCalledWith({
      message: "[getRelatedNotes] 관련 노트 조회 실패",
      error: dbError,
    });
  });

  it("조회 결과가 스키마와 맞지 않으면 오류를 기록하고 빈 배열을 반환한다", async () => {
    const { supabase } = createSupabaseQueryMock({
      note_related_notes: {
        data: [
          {
            related_note_id: "not-a-uuid",
            origin: "ai",
            metadata: {
              title: "관련 노트",
              reason: "비슷한 내용을 다룹니다.",
            },
          },
        ],
      },
    });

    createClientMock.mockResolvedValue(supabase as never);

    const result = await getRelatedNotes(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result).toEqual([]);
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "[getRelatedNotes] 관련 노트 파싱 실패",
      }),
    );
  });
});

describe("getRelatedNoteCandidates", () => {
  const noteId = "11111111-1111-4111-8111-111111111111";
  const relatedNoteId = "22222222-2222-4222-8222-222222222222";
  const candidateNoteId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("현재 Note와 기존 관계를 제외하고 Related Note 후보를 조회한다", async () => {
    const sourceMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: noteId,
      },
      error: null,
    });

    const sourceUserEqMock = vi.fn().mockReturnValue({
      maybeSingle: sourceMaybeSingleMock,
    });

    const sourceNoteEqMock = vi.fn().mockReturnValue({
      eq: sourceUserEqMock,
    });

    const sourceSelectMock = vi.fn().mockReturnValue({
      eq: sourceNoteEqMock,
    });

    const relationEqMock = vi.fn().mockResolvedValue({
      data: [
        {
          related_note_id: relatedNoteId,
        },
      ],
      error: null,
    });

    const relationSelectMock = vi.fn().mockReturnValue({
      eq: relationEqMock,
    });

    const candidateRangeMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: candidateNoteId,
          title: "후보 노트",
        },
      ],
      count: 1,
      error: null,
    });

    const candidateIlikeMock = vi.fn().mockReturnValue({
      range: candidateRangeMock,
    });

    const candidateOrderMock = vi.fn().mockReturnValue({
      ilike: candidateIlikeMock,
      range: candidateRangeMock,
    });

    const candidateNotMock = vi.fn().mockReturnValue({
      order: candidateOrderMock,
    });

    const candidateUserEqMock = vi.fn().mockReturnValue({
      not: candidateNotMock,
    });

    const candidateSelectMock = vi.fn().mockReturnValue({
      eq: candidateUserEqMock,
    });

    /*
     * getRelatedNoteCandidates는 notes를 두 번 조회합니다.
     *
     * 첫 번째 조회는 기준 Note의 소유권 확인,
     * 두 번째 조회는 실제 Related Note 후보 목록 조회입니다.
     */
    const fromMock = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: sourceSelectMock,
      }))
      .mockImplementationOnce(() => ({
        select: relationSelectMock,
      }))
      .mockImplementationOnce(() => ({
        select: candidateSelectMock,
      }));

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
            },
          },
        }),
      },
      from: fromMock,
    } as never);

    const result = await getRelatedNoteCandidates(noteId, 2, "후보", 8);

    expect(fromMock).toHaveBeenNthCalledWith(1, "notes");
    expect(sourceNoteEqMock).toHaveBeenCalledWith("id", noteId);
    expect(sourceUserEqMock).toHaveBeenCalledWith("user_id", "user-123");

    expect(fromMock).toHaveBeenNthCalledWith(2, "note_related_notes");
    expect(relationEqMock).toHaveBeenCalledWith("note_id", noteId);

    expect(fromMock).toHaveBeenNthCalledWith(3, "notes");
    expect(candidateUserEqMock).toHaveBeenCalledWith("user_id", "user-123");
    expect(candidateNotMock).toHaveBeenCalledWith(
      "id",
      "in",
      `(${noteId},${relatedNoteId})`,
    );
    expect(candidateIlikeMock).toHaveBeenCalledWith("title", "%후보%");
    expect(candidateRangeMock).toHaveBeenCalledWith(8, 15);

    expect(result).toEqual({
      notes: [
        {
          id: candidateNoteId,
          title: "후보 노트",
        },
      ],
      total: 1,
    });
  });

  it("인증된 사용자가 없으면 빈 후보 목록을 반환한다", async () => {
    const { supabase, from } = createSupabaseQueryMock({});

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: null,
          },
        }),
      },
    } as never);

    const result = await getRelatedNoteCandidates(noteId);

    expect(result).toEqual({
      notes: [],
      total: 0,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("기준 Note가 현재 사용자의 Note가 아니면 후보를 조회하지 않는다", async () => {
    const { supabase, callsFor } = createSupabaseQueryMock({
      notes: {
        data: null,
      },
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
            },
          },
        }),
      },
    } as never);

    const result = await getRelatedNoteCandidates(noteId);

    expect(result).toEqual({
      notes: [],
      total: 0,
    });

    expect(callsFor("note_related_notes")).toEqual([]);
  });
});
