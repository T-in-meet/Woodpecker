import { describe, expect, it, vi } from "vitest";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import { AI_EMBEDDING_DIMENSIONS } from "../../constants/embeddings";
import { reportAiOperationalError } from "../../utils/report-ai-operational-error";
import { createAiSha256Hash } from "../hash";
import { matchAiEmbeddings } from "../match";
import { formatAiVectorLiteral } from "../vector";

vi.mock("../../utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn(),
}));

/** 테스트용 1536차원 벡터를 생성합니다. */
function createVector(value: number) {
  return Array.from({ length: AI_EMBEDDING_DIMENSIONS }, () => value);
}

/** AI embedding 검색에 사용할 기본 입력을 생성합니다. */
function createMatchParams() {
  return {
    inputKind: "rag_note_content",
    modelConfigId: "11111111-1111-4111-8111-111111111111",
    ownerUserId: "33333333-3333-4333-8333-333333333333",
    queryEmbedding: createVector(0),
    sourceType: "note",
  };
}

describe("createAiSha256Hash", () => {
  it("creates a stable SHA-256 hash", () => {
    expect(createAiSha256Hash("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("formatAiVectorLiteral", () => {
  it("formats a 1536 dimension vector for pgvector", () => {
    expect(formatAiVectorLiteral(createVector(0))).toBe(
      `[${createVector(0).join(",")}]`,
    );
  });

  it("rejects non-1536 dimension vectors", () => {
    expect(() => formatAiVectorLiteral([0.1, 0.2])).toThrow(
      "exactly 1536 dimensions",
    );
  });

  it("rejects non-finite values", () => {
    const vector = createVector(0);

    vector[0] = Number.NaN;

    expect(() => formatAiVectorLiteral(vector)).toThrow("finite numbers");
  });
});

describe("matchAiEmbeddings", () => {
  it("전달한 검색 조건으로 RPC를 호출하고 결과를 반환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          chunk_index: 0,
          distance: 0,
          embedding_id: "22222222-2222-4222-8222-222222222222",
          similarity: 1,
          source_id: "44444444-4444-4444-8444-444444444444",
        },
      ],
      error: null,
    });

    const result = await matchAiEmbeddings(
      {
        ...createMatchParams(),
        limit: 3,
        minSimilarity: 0.2,
      },
      {
        supabase: {
          rpc,
        },
      },
    );

    expect(rpc).toHaveBeenCalledWith("match_ai_embeddings", {
      p_exclude_source_ids: null,
      p_input_kind: "rag_note_content",
      p_limit: 3,
      p_min_similarity: 0.2,
      p_model_config_id: "11111111-1111-4111-8111-111111111111",
      p_owner_user_id: "33333333-3333-4333-8333-333333333333",
      p_query_embedding: `[${createVector(0).join(",")}]`,
      p_source_type: "note",
    });

    expect(result).toEqual([
      {
        chunk_index: 0,
        distance: 0,
        embedding_id: "22222222-2222-4222-8222-222222222222",
        similarity: 1,
        source_id: "44444444-4444-4444-8444-444444444444",
      },
    ]);
  });

  it("제외할 source ID 목록이 지정되면 RPC에 전달한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const excludeSourceIds = [
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ];

    const result = await matchAiEmbeddings(
      {
        ...createMatchParams(),
        excludeSourceIds,
      },
      {
        supabase: {
          rpc,
        },
      },
    );

    expect(rpc).toHaveBeenCalledWith("match_ai_embeddings", {
      p_exclude_source_ids: excludeSourceIds,
      p_input_kind: "rag_note_content",
      p_limit: 10,
      p_min_similarity: null,
      p_model_config_id: "11111111-1111-4111-8111-111111111111",
      p_owner_user_id: "33333333-3333-4333-8333-333333333333",
      p_query_embedding: `[${createVector(0).join(",")}]`,
      p_source_type: "note",
    });

    expect(result).toEqual([]);
  });

  it("검색 조건이 없으면 기본 limit과 minSimilarity를 사용한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await matchAiEmbeddings(createMatchParams(), {
      supabase: {
        rpc,
      },
    });

    expect(rpc).toHaveBeenCalledWith("match_ai_embeddings", {
      p_exclude_source_ids: null,
      p_input_kind: "rag_note_content",
      p_limit: 10,
      p_min_similarity: null,
      p_model_config_id: "11111111-1111-4111-8111-111111111111",
      p_owner_user_id: "33333333-3333-4333-8333-333333333333",
      p_query_embedding: `[${createVector(0).join(",")}]`,
      p_source_type: "note",
    });

    expect(result).toEqual([]);
  });

  it("RPC 조회에 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "rpc failed",
      },
    });

    await expect(
      matchAiEmbeddings(createMatchParams(), {
        supabase: {
          rpc,
        },
      }),
    ).rejects.toThrow("Failed to match AI embeddings: rpc failed");

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: "rpc failed",
        }),
        errorCode: AI_OPERATIONAL_ERROR_CODE.VECTOR_MATCH_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.MATCH_EMBEDDINGS,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      }),
    );
  });

  it("RPC 결과가 스키마와 일치하지 않으면 예외를 던진다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          distance: "invalid",
          embedding_id: "22222222-2222-4222-8222-222222222222",
          similarity: 1,
          source_id: "44444444-4444-4444-8444-444444444444",
        },
      ],
      error: null,
    });

    await expect(
      matchAiEmbeddings(createMatchParams(), {
        supabase: {
          rpc,
        },
      }),
    ).rejects.toThrow();
  });
});
