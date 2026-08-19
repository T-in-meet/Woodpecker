import { beforeEach, describe, expect, it, vi } from "vitest";

import { logError } from "@/lib/logger";
import { createServerComponentClient } from "@/lib/supabase/server";
import { createSupabaseQueryMock } from "@/tests/supabaseQueryMock";

import { getRelatedNotes } from "../queries";

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

    expect(result).toEqual([
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
