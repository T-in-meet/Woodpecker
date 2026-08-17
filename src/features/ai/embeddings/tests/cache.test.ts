import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import { AI_EMBEDDING_DIMENSIONS } from "../../constants/embeddings";
import { reportAiOperationalError } from "../../utils/report-ai-operational-error";
import {
  deleteInactiveAiEmbeddingGeneration,
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

const GENERATION_ID = "55555555-5555-4555-8555-555555555555";

const CACHE_INPUT = {
  chunkCount: 2,
  chunkIndex: 0,
  contentHash: "content-hash",
  generationId: GENERATION_ID,
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
  chunk_count: 2,
  chunk_index: 0,
  content_hash: "content-hash",
  created_at: "2026-08-03T00:00:00.000Z",
  embedding: "[0,0]",
  generation_id: GENERATION_ID,
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

  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });

  const eq4 = vi.fn().mockReturnValue({ order });
  const eq3 = vi.fn().mockReturnValue({ eq: eq4 });
  const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });

  const select = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ select });

  return {
    eqMocks: [eq1, eq2, eq3, eq4],
    from,
    limit,
    maybeSingle,
    order,
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

  it("동일 사용자·모델·입력 용도·입력의 최신 cache를 조회한다", async () => {
    const { eqMocks, from, limit, order, supabase } =
      createCacheReadSupabase(CACHE_ROW);

    const result = await getAiEmbeddingCache(CACHE_INPUT, { supabase });

    expect(from).toHaveBeenCalledWith("ai_embeddings");

    expect(eqMocks[0]).toHaveBeenCalledWith(
      "owner_user_id",
      CACHE_INPUT.ownerUserId,
    );
    expect(eqMocks[1]).toHaveBeenCalledWith(
      "model_config_id",
      CACHE_INPUT.modelConfigId,
    );
    expect(eqMocks[2]).toHaveBeenCalledWith(
      "input_kind",
      CACHE_INPUT.inputKind,
    );
    expect(eqMocks[3]).toHaveBeenCalledWith(
      "input_hash",
      CACHE_INPUT.inputHash,
    );

    expect(order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(limit).toHaveBeenCalledWith(1);

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

  it("embedding과 generation 및 chunk 정보를 저장하고 반환 행을 검증한다", async () => {
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
      chunk_count: CACHE_INPUT.chunkCount,
      chunk_index: CACHE_INPUT.chunkIndex,
      content_hash: CACHE_INPUT.contentHash,
      embedding: `[${vector.join(",")}]`,
      generation_id: CACHE_INPUT.generationId,
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
});

describe("deleteInactiveAiEmbeddingGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const input = {
    generationId: CACHE_INPUT.generationId,
    inputKind: CACHE_INPUT.inputKind,
    modelConfigId: CACHE_INPUT.modelConfigId,
    ownerUserId: CACHE_INPUT.ownerUserId,
    sourceId: CACHE_INPUT.sourceId,
    sourceType: CACHE_INPUT.sourceType,
  };

  it("비활성 generation cleanup RPC를 호출하고 삭제된 chunk 수를 반환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: 2,
      error: null,
    });

    const result = await deleteInactiveAiEmbeddingGeneration(input, {
      supabase: {
        rpc,
      } as never,
    });

    expect(rpc).toHaveBeenCalledWith(
      "delete_inactive_ai_embedding_generation",
      {
        p_generation_id: input.generationId,
        p_input_kind: input.inputKind,
        p_model_config_id: input.modelConfigId,
        p_owner_user_id: input.ownerUserId,
        p_source_id: input.sourceId,
        p_source_type: input.sourceType,
      },
    );

    expect(result).toBe(2);
  });

  it("cleanup RPC가 실패하면 운영 오류를 보고하고 예외를 발생시킨다", async () => {
    const databaseError = {
      message: "cleanup failed",
    };

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: databaseError,
    });

    await expect(
      deleteInactiveAiEmbeddingGeneration(input, {
        supabase: {
          rpc,
        } as never,
      }),
    ).rejects.toThrow(
      "Failed to delete inactive AI embedding generation: cleanup failed",
    );

    expect(reportAiOperationalError).toHaveBeenCalledWith({
      error: databaseError,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_DELETE_FAILED,
      message: "AI embedding generation 정리에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.DELETE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      context: {
        generationId: input.generationId,
        inputKind: input.inputKind,
        modelConfigId: input.modelConfigId,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
      },
    });
  });
});
