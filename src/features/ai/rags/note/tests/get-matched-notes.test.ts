import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiEmbeddingMatchRow } from "@/features/ai/embeddings/types";

import { getMatchedNotes } from "../get-matched-notes";

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

const createMatches = (): [AiEmbeddingMatchRow, AiEmbeddingMatchRow] => [
  {
    distance: 0.1,
    embedding_id: "embedding-1",
    similarity: 0.9,
    source_id: "11111111-1111-4111-8111-111111111111",
  },
  {
    distance: 0.2,
    embedding_id: "embedding-2",
    similarity: 0.8,
    source_id: "22222222-2222-4222-8222-222222222222",
  },
];

const createSupabaseClient = (
  data: unknown[] | null,
  error: { message: string } | null = null,
) => {
  const query = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data, error }),
    select: vi.fn().mockReturnThis(),
  };

  return {
    from: vi.fn().mockReturnValue(query),
    query,
  };
};

describe("getMatchedNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("검색 결과가 없으면 빈 배열을 반환한다", async () => {
    const supabase = createSupabaseClient([]);
    createAdminClientMock.mockReturnValue(supabase);

    const result = await getMatchedNotes({
      matches: [],
      ownerUserId: "user-1",
    });

    expect(result).toEqual([]);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("Embedding 검색 결과와 Note 정보를 결합한다", async () => {
    const matches = createMatches();
    const supabase = createSupabaseClient([
      {
        content: "첫 번째 내용",
        id: matches[0].source_id,
        title: "첫 번째 노트",
      },
      {
        content: "두 번째 내용",
        id: matches[1].source_id,
        title: "두 번째 노트",
      },
    ]);

    createAdminClientMock.mockReturnValue(supabase);

    const result = await getMatchedNotes({
      matches,
      ownerUserId: "user-1",
    });

    expect(result).toEqual([
      {
        content: "첫 번째 내용",
        distance: 0.1,
        embeddingId: "embedding-1",
        id: matches[0].source_id,
        similarity: 0.9,
        title: "첫 번째 노트",
      },
      {
        content: "두 번째 내용",
        distance: 0.2,
        embeddingId: "embedding-2",
        id: matches[1].source_id,
        similarity: 0.8,
        title: "두 번째 노트",
      },
    ]);
  });

  it("DB 조회 순서와 관계없이 Embedding 검색 결과 순서를 유지한다", async () => {
    const matches = createMatches();
    const supabase = createSupabaseClient([
      {
        content: "두 번째 내용",
        id: matches[1].source_id,
        title: "두 번째 노트",
      },
      {
        content: "첫 번째 내용",
        id: matches[0].source_id,
        title: "첫 번째 노트",
      },
    ]);

    createAdminClientMock.mockReturnValue(supabase);

    const result = await getMatchedNotes({
      matches,
      ownerUserId: "user-1",
    });

    expect(result.map((note) => note.id)).toEqual([
      matches[0].source_id,
      matches[1].source_id,
    ]);
  });

  it("조회되지 않은 Note를 결과에서 제외한다", async () => {
    const matches = createMatches();
    const supabase = createSupabaseClient([
      {
        content: "첫 번째 내용",
        id: matches[0].source_id,
        title: "첫 번째 노트",
      },
    ]);

    createAdminClientMock.mockReturnValue(supabase);

    const result = await getMatchedNotes({
      matches,
      ownerUserId: "user-1",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      content: "첫 번째 내용",
      id: matches[0].source_id,
      title: "첫 번째 노트",
    });
  });

  it("Note 조회에 실패하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseClient(null, {
      message: "database error",
    });

    createAdminClientMock.mockReturnValue(supabase);

    await expect(
      getMatchedNotes({
        matches: createMatches(),
        ownerUserId: "user-1",
      }),
    ).rejects.toThrow("Failed to get matched notes: database error");
  });

  it("현재 사용자가 소유한 Note만 조회한다", async () => {
    const matches = createMatches();
    const supabase = createSupabaseClient([]);

    createAdminClientMock.mockReturnValue(supabase);

    await getMatchedNotes({
      matches,
      ownerUserId: "user-1",
    });

    expect(supabase.from).toHaveBeenCalledWith("notes");
    expect(supabase.query.select).toHaveBeenCalledWith("id, title, content");
    expect(supabase.query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(supabase.query.in).toHaveBeenCalledWith("id", [
      matches[0].source_id,
      matches[1].source_id,
    ]);
  });
});
