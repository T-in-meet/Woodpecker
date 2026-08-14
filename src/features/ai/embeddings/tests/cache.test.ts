import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import { AI_EMBEDDING_DIMENSIONS } from "../../constants/embeddings";
import { reportAiOperationalError } from "../../utils/report-ai-operational-error";
import {
  deleteAiEmbeddingsBySource,
  getAiEmbeddingCache,
  insertAiEmbedding,
} from "../cache";

vi.mock("../../utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn(),
}));

/** getAiEmbeddingCache에 주입할 Supabase stub 타입입니다. */
type CacheSupabase = NonNullable<
  Parameters<typeof getAiEmbeddingCache>[1]
>["supabase"];

const CACHE_INPUT = {
  contentHash: "content-hash",
  inputHash: "input-hash",
  inputKind: "rag_note_content",
  inputPreview: "preview",
  inputText: "full input",
  modelConfigId: "11111111-1111-4111-8111-111111111111",
  ownerUserId: "22222222-2222-4222-8222-222222222222",
  sourceId: "44444444-4444-4444-8444-444444444444",
  sourceType: "note",
};

const CACHE_ROW = {
  content_hash: "content-hash",
  created_at: "2026-08-03T00:00:00.000Z",
  embedding: "[0,0]",
  id: "33333333-3333-4333-8333-333333333333",
  input_hash: "input-hash",
  input_kind: "rag_note_content",
  input_preview: "preview",
  input_text: "full input",
  model_config_id: "11111111-1111-4111-8111-111111111111",
  owner_user_id: "22222222-2222-4222-8222-222222222222",
  source_id: "44444444-4444-4444-8444-444444444444",
  source_type: "note",
  token_count: 10,
};

function createVector(value: number) {
  return Array.from({ length: AI_EMBEDDING_DIMENSIONS }, () => value);
}

function createCacheReadSupabase(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });

  const eq6 = vi.fn().mockReturnValue({ maybeSingle });
  const eq5 = vi.fn().mockReturnValue({ eq: eq6 });
  const eq4 = vi.fn().mockReturnValue({ eq: eq5 });
  const eq3 = vi.fn().mockReturnValue({ eq: eq4 });
  const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });

  const select = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ select });

  return {
    eqMocks: [eq1, eq2, eq3, eq4, eq5, eq6],
    from,
    maybeSingle,
    select,
    supabase: {
      from,
    } as unknown as CacheSupabase,
  };
}

function createCacheInsertSupabase(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });

  return {
    from,
    insert,
    select,
    single,
    supabase: {
      from,
    } as unknown as CacheSupabase,
  };
}

describe("getAiEmbeddingCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("전체 cache key로 조회하고 일치하는 행을 반환한다", async () => {
    const { eqMocks, from, supabase } = createCacheReadSupabase(CACHE_ROW);

    const result = await getAiEmbeddingCache(CACHE_INPUT, { supabase });

    expect(from).toHaveBeenCalledWith("ai_embeddings");

    expect(eqMocks[0]).toHaveBeenCalledWith(
      "owner_user_id",
      CACHE_INPUT.ownerUserId,
    );
    expect(eqMocks[1]).toHaveBeenCalledWith(
      "source_type",
      CACHE_INPUT.sourceType,
    );
    expect(eqMocks[2]).toHaveBeenCalledWith("source_id", CACHE_INPUT.sourceId);
    expect(eqMocks[3]).toHaveBeenCalledWith(
      "model_config_id",
      CACHE_INPUT.modelConfigId,
    );
    expect(eqMocks[4]).toHaveBeenCalledWith(
      "input_kind",
      CACHE_INPUT.inputKind,
    );
    expect(eqMocks[5]).toHaveBeenCalledWith(
      "content_hash",
      CACHE_INPUT.contentHash,
    );

    expect(result).toEqual(CACHE_ROW);
  });

  it("일치하는 cache가 없으면 null을 반환한다", async () => {
    const { supabase } = createCacheReadSupabase(null);

    await expect(
      getAiEmbeddingCache(CACHE_INPUT, { supabase }),
    ).resolves.toBeNull();
  });

  it("cache 조회에 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const { supabase } = createCacheReadSupabase(null, {
      message: "cache read failed",
    });

    await expect(
      getAiEmbeddingCache(CACHE_INPUT, { supabase }),
    ).rejects.toThrow("Failed to read AI embedding cache: cache read failed");

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: "cache read failed",
        }),
        errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_CACHE_READ_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.GET_EMBEDDING_CACHE,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      }),
    );
  });

  it("조회 결과가 스키마와 일치하지 않으면 예외를 던진다", async () => {
    const { supabase } = createCacheReadSupabase({
      ...CACHE_ROW,
      owner_user_id: "invalid-user-id",
    });

    await expect(
      getAiEmbeddingCache(CACHE_INPUT, { supabase }),
    ).rejects.toThrow();
  });
});

describe("insertAiEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("embedding과 cache 정보를 저장하고 반환 행을 검증한다", async () => {
    const { insert, supabase } = createCacheInsertSupabase(CACHE_ROW);
    const vector = createVector(0);

    const result = await insertAiEmbedding(
      {
        ...CACHE_INPUT,
        embedding: vector,
        tokenCount: 10,
      },
      { supabase },
    );

    expect(insert).toHaveBeenCalledWith({
      content_hash: CACHE_INPUT.contentHash,
      embedding: `[${vector.join(",")}]`,
      input_hash: CACHE_INPUT.inputHash,
      input_kind: CACHE_INPUT.inputKind,
      input_preview: CACHE_INPUT.inputPreview,
      input_text: CACHE_INPUT.inputText,
      model_config_id: CACHE_INPUT.modelConfigId,
      owner_user_id: CACHE_INPUT.ownerUserId,
      source_id: CACHE_INPUT.sourceId,
      source_type: CACHE_INPUT.sourceType,
      token_count: 10,
    });

    expect(result).toEqual(CACHE_ROW);
  });

  it("tokenCount가 없으면 null로 저장한다", async () => {
    const row = {
      ...CACHE_ROW,
      token_count: null,
    };

    const { insert, supabase } = createCacheInsertSupabase(row);

    await insertAiEmbedding(
      {
        ...CACHE_INPUT,
        embedding: createVector(0),
      },
      { supabase },
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        token_count: null,
      }),
    );
  });

  it("cache 삽입에 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const { supabase } = createCacheInsertSupabase(null, {
      message: "cache insert failed",
    });

    await expect(
      insertAiEmbedding(
        {
          ...CACHE_INPUT,
          embedding: createVector(0),
          tokenCount: 10,
        },
        { supabase },
      ),
    ).rejects.toThrow("Failed to insert AI embedding: cache insert failed");

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: "cache insert failed",
        }),
        errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_INSERT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.INSERT_EMBEDDING,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      }),
    );
  });

  it("삽입 후 반환 행이 스키마와 일치하지 않으면 예외를 던진다", async () => {
    const { supabase } = createCacheInsertSupabase({
      ...CACHE_ROW,
      token_count: -1,
    });

    await expect(
      insertAiEmbedding(
        {
          ...CACHE_INPUT,
          embedding: createVector(0),
          tokenCount: 10,
        },
        { supabase },
      ),
    ).rejects.toThrow();
  });

  it("유효하지 않은 embedding 벡터는 DB 삽입 전에 거부한다", async () => {
    const { insert, supabase } = createCacheInsertSupabase(CACHE_ROW);

    await expect(
      insertAiEmbedding(
        {
          ...CACHE_INPUT,
          embedding: [0.1, 0.2],
          tokenCount: 10,
        },
        { supabase },
      ),
    ).rejects.toThrow(
      `AI vector must contain exactly ${AI_EMBEDDING_DIMENSIONS} dimensions.`,
    );

    expect(insert).not.toHaveBeenCalled();
  });

  describe("deleteAiEmbeddingsBySource", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("source와 input kind가 일치하는 기존 embedding을 삭제하고 삭제 개수를 반환한다", async () => {
      const response = {
        count: 2,
        error: null,
      };

      const query = {
        delete: vi.fn(),
        eq: vi.fn(),
        neq: vi.fn(),
        then: (resolve: (value: typeof response) => unknown) =>
          Promise.resolve(resolve(response)),
      };

      query.delete.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.neq.mockReturnValue(query);

      const supabase = {
        from: vi.fn().mockReturnValue(query),
      };

      const result = await deleteAiEmbeddingsBySource(
        {
          ownerUserId: "user-id",
          sourceType: "note",
          sourceId: "note-id",
          inputKind: "rag_note_content",
        },
        { supabase: supabase as never },
      );

      expect(result).toBe(2);

      expect(supabase.from).toHaveBeenCalledWith("ai_embeddings");

      expect(query.delete).toHaveBeenCalledWith({
        count: "exact",
      });

      expect(query.eq).toHaveBeenNthCalledWith(1, "owner_user_id", "user-id");
      expect(query.eq).toHaveBeenNthCalledWith(2, "source_type", "note");
      expect(query.eq).toHaveBeenNthCalledWith(3, "source_id", "note-id");
      expect(query.eq).toHaveBeenNthCalledWith(
        4,
        "input_kind",
        "rag_note_content",
      );

      expect(query.neq).not.toHaveBeenCalled();
    });

    it("excludeEmbeddingId가 있으면 해당 embedding을 삭제 대상에서 제외한다", async () => {
      const response = {
        count: 2,
        error: null,
      };

      const query = {
        delete: vi.fn(),
        eq: vi.fn(),
        neq: vi.fn(),
        then: (resolve: (value: typeof response) => unknown) =>
          Promise.resolve(resolve(response)),
      };

      query.delete.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.neq.mockReturnValue(query);

      const supabase = {
        from: vi.fn().mockReturnValue(query),
      };

      const result = await deleteAiEmbeddingsBySource(
        {
          ownerUserId: "user-id",
          sourceType: "note",
          sourceId: "note-id",
          inputKind: "rag_note_content",
          excludeEmbeddingId: "new-embedding-id",
        },
        { supabase: supabase as never },
      );

      expect(result).toBe(2);

      expect(query.neq).toHaveBeenCalledWith("id", "new-embedding-id");
    });

    it("삭제에 실패하면 operational error를 기록하고 오류를 발생시킨다", async () => {
      const databaseError = {
        message: "delete failed",
      };

      const response = {
        count: null,
        error: databaseError,
      };

      const query = {
        delete: vi.fn(),
        eq: vi.fn(),
        neq: vi.fn(),
        then: (resolve: (value: typeof response) => unknown) =>
          Promise.resolve(resolve(response)),
      };

      query.delete.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.neq.mockReturnValue(query);

      const supabase = {
        from: vi.fn().mockReturnValue(query),
      };

      await expect(
        deleteAiEmbeddingsBySource(
          {
            ownerUserId: "user-id",
            sourceType: "note",
            sourceId: "note-id",
            inputKind: "rag_note_content",
            excludeEmbeddingId: "new-embedding-id",
          },
          { supabase: supabase as never },
        ),
      ).rejects.toThrow("Failed to delete AI embeddings: delete failed");

      expect(reportAiOperationalError).toHaveBeenCalledWith({
        error: databaseError,
        errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_DELETE_FAILED,
        message: "AI embedding 삭제에 실패했습니다.",
        operation: AI_OPERATIONAL_ERROR_OPERATION.DELETE_EMBEDDING,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });
    });
  });
});
