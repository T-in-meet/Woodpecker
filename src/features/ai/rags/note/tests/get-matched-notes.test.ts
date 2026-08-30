import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import { getMatchedNotes } from "../get-matched-notes";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const NOTE_A_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_B_ID = "22222222-2222-4222-8222-222222222222";
const EMBEDDING_A_0_ID = "33333333-3333-4333-8333-333333333333";
const EMBEDDING_A_1_ID = "44444444-4444-4444-8444-444444444444";
const EMBEDDING_B_ID = "55555555-5555-4555-8555-555555555555";

function createSupabaseStub({
  notesData,
  notesError = null,
  embeddingsData,
  embeddingsError = null,
}: {
  notesData: unknown;
  notesError?: { message: string } | null;
  embeddingsData: unknown;
  embeddingsError?: { message: string } | null;
}) {
  const notesIn = vi.fn().mockResolvedValue({
    data: notesData,
    error: notesError,
  });

  const notesEq = vi.fn().mockReturnValue({
    in: notesIn,
  });

  const notesSelect = vi.fn().mockReturnValue({
    eq: notesEq,
  });

  const embeddingsIn = vi.fn().mockResolvedValue({
    data: embeddingsData,
    error: embeddingsError,
  });

  const embeddingEq3 = vi.fn().mockReturnValue({
    in: embeddingsIn,
  });

  const embeddingEq2 = vi.fn().mockReturnValue({
    eq: embeddingEq3,
  });

  const embeddingEq1 = vi.fn().mockReturnValue({
    eq: embeddingEq2,
  });

  const embeddingsSelect = vi.fn().mockReturnValue({
    eq: embeddingEq1,
  });

  const from = vi.fn((table: string) => {
    if (table === "notes") {
      return {
        select: notesSelect,
      };
    }

    if (table === "ai_embeddings") {
      return {
        select: embeddingsSelect,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    embeddingEqMocks: [embeddingEq1, embeddingEq2, embeddingEq3],
    embeddingsIn,
    from,
    notesEq,
    notesIn,
    supabase: {
      from,
    },
  };
}

describe("getMatchedNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("검색 결과가 없으면 DB를 조회하지 않고 빈 배열을 반환한다", async () => {
    const result = await getMatchedNotes({
      matches: [],
      ownerUserId: "user-id",
    });

    expect(result).toEqual([]);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("검색 순서를 유지하며 실제 embedding chunk snapshot을 Note와 결합한다", async () => {
    const matches = [
      {
        chunk_index: 1,
        distance: 0.1,
        embedding_id: EMBEDDING_A_1_ID,
        similarity: 0.9,
        source_id: NOTE_A_ID,
      },
      {
        chunk_index: 0,
        distance: 0.2,
        embedding_id: EMBEDDING_B_ID,
        similarity: 0.8,
        source_id: NOTE_B_ID,
      },
      {
        chunk_index: 0,
        distance: 0.3,
        embedding_id: EMBEDDING_A_0_ID,
        similarity: 0.7,
        source_id: NOTE_A_ID,
      },
    ];

    const { from, supabase } = createSupabaseStub({
      /*
       * DB 조회 결과 순서를 일부러 검색 순서와 다르게 둡니다.
       * getMatchedNotes가 matches 순서로 다시 조합해야 합니다.
       */
      notesData: [
        {
          id: NOTE_B_ID,
          title: "벨만-포드",
        },
        {
          id: NOTE_A_ID,
          title: "다익스트라",
        },
      ],
      embeddingsData: [
        {
          id: EMBEDDING_A_0_ID,
          input_text: "Title:\n다익스트라\n\nContent:\nchunk 0",
          source_id: NOTE_A_ID,
        },
        {
          id: EMBEDDING_B_ID,
          input_text: "Title:\n벨만-포드\n\nContent:\nchunk 0",
          source_id: NOTE_B_ID,
        },
        {
          id: EMBEDDING_A_1_ID,
          input_text: "Title:\n다익스트라\n\nContent:\nchunk 1",
          source_id: NOTE_A_ID,
        },
      ],
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    const result = await getMatchedNotes({
      matches,
      ownerUserId: "user-id",
    });

    expect(from).toHaveBeenCalledWith("notes");
    expect(from).toHaveBeenCalledWith("ai_embeddings");

    expect(result).toEqual([
      {
        chunkText: "Title:\n다익스트라\n\nContent:\nchunk 1",
        distance: 0.1,
        embeddingId: EMBEDDING_A_1_ID,
        id: NOTE_A_ID,
        similarity: 0.9,
        title: "다익스트라",
      },
      {
        chunkText: "Title:\n벨만-포드\n\nContent:\nchunk 0",
        distance: 0.2,
        embeddingId: EMBEDDING_B_ID,
        id: NOTE_B_ID,
        similarity: 0.8,
        title: "벨만-포드",
      },
      {
        chunkText: "Title:\n다익스트라\n\nContent:\nchunk 0",
        distance: 0.3,
        embeddingId: EMBEDDING_A_0_ID,
        id: NOTE_A_ID,
        similarity: 0.7,
        title: "다익스트라",
      },
    ]);
  });

  it("현재 존재하지 않거나 소유하지 않은 Note의 chunk는 결과에서 제외한다", async () => {
    const { supabase } = createSupabaseStub({
      notesData: [],
      embeddingsData: [
        {
          id: EMBEDDING_A_0_ID,
          input_text: "Title:\n다익스트라\n\nContent:\nchunk",
          source_id: NOTE_A_ID,
        },
      ],
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    const result = await getMatchedNotes({
      matches: [
        {
          chunk_index: 0,
          distance: 0.1,
          embedding_id: EMBEDDING_A_0_ID,
          similarity: 0.9,
          source_id: NOTE_A_ID,
        },
      ],
      ownerUserId: "user-id",
    });

    expect(result).toEqual([]);
  });

  it("embedding snapshot의 source가 검색 결과 source와 다르면 제외한다", async () => {
    const { supabase } = createSupabaseStub({
      notesData: [
        {
          id: NOTE_A_ID,
          title: "다익스트라",
        },
      ],
      embeddingsData: [
        {
          id: EMBEDDING_A_0_ID,
          input_text: "Title:\n다른 노트\n\nContent:\nchunk",
          source_id: NOTE_B_ID,
        },
      ],
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    const result = await getMatchedNotes({
      matches: [
        {
          chunk_index: 0,
          distance: 0.1,
          embedding_id: EMBEDDING_A_0_ID,
          similarity: 0.9,
          source_id: NOTE_A_ID,
        },
      ],
      ownerUserId: "user-id",
    });

    expect(result).toEqual([]);
  });

  it("Note 조회에 실패하면 오류를 전달한다", async () => {
    const { supabase } = createSupabaseStub({
      notesData: null,
      notesError: {
        message: "note query failed",
      },
      embeddingsData: [],
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    await expect(
      getMatchedNotes({
        matches: [
          {
            chunk_index: 0,
            distance: 0.1,
            embedding_id: EMBEDDING_A_0_ID,
            similarity: 0.9,
            source_id: NOTE_A_ID,
          },
        ],
        ownerUserId: "user-id",
      }),
    ).rejects.toThrow("Failed to get matched notes: note query failed");
  });

  it("Embedding snapshot 조회에 실패하면 오류를 전달한다", async () => {
    const { supabase } = createSupabaseStub({
      notesData: [
        {
          id: NOTE_A_ID,
          title: "다익스트라",
        },
      ],
      embeddingsData: null,
      embeddingsError: {
        message: "embedding query failed",
      },
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    await expect(
      getMatchedNotes({
        matches: [
          {
            chunk_index: 0,
            distance: 0.1,
            embedding_id: EMBEDDING_A_0_ID,
            similarity: 0.9,
            source_id: NOTE_A_ID,
          },
        ],
        ownerUserId: "user-id",
      }),
    ).rejects.toThrow(
      "Failed to get matched note embeddings: embedding query failed",
    );
  });
});
