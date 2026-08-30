import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { reportAiOperationalError } from "../../utils/report-ai-operational-error";
import {
  activateAiEmbeddingGeneration,
  hasActiveAiEmbeddingGenerationForContent,
} from "../generation";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("../../utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn(),
}));

const INPUT = {
  generationId: "11111111-1111-4111-8111-111111111111",
  inputKind: "rag_note_content",
  modelConfigId: "22222222-2222-4222-8222-222222222222",
  ownerUserId: "33333333-3333-4333-8333-333333333333",
  sourceId: "44444444-4444-4444-8444-444444444444",
  sourceType: "note",
  sourceUpdatedAt: "2026-08-17T06:20:00.000Z",
};

const CONTENT_HASH = "note-content-hash";

describe("hasActiveAiEmbeddingGenerationForContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("동일한 model과 content hash의 활성 generation이 있으면 true를 반환한다", async () => {
    const activeGenerationMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        active_model_config_id: INPUT.modelConfigId,
        active_generation_id: INPUT.generationId,
      },
      error: null,
    });

    const activeGenerationQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: activeGenerationMaybeSingle,
    };

    activeGenerationQuery.select.mockReturnValue(activeGenerationQuery);
    activeGenerationQuery.eq.mockReturnValue(activeGenerationQuery);

    const activeEmbeddingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "55555555-5555-4555-8555-555555555555",
      },
      error: null,
    });

    const activeEmbeddingQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: activeEmbeddingMaybeSingle,
    };

    activeEmbeddingQuery.select.mockReturnValue(activeEmbeddingQuery);
    activeEmbeddingQuery.eq.mockReturnValue(activeEmbeddingQuery);
    activeEmbeddingQuery.limit.mockReturnValue(activeEmbeddingQuery);

    const from = vi
      .fn()
      .mockReturnValueOnce(activeGenerationQuery)
      .mockReturnValueOnce(activeEmbeddingQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as never);

    await expect(
      hasActiveAiEmbeddingGenerationForContent({
        contentHash: CONTENT_HASH,
        inputKind: INPUT.inputKind,
        modelConfigId: INPUT.modelConfigId,
        ownerUserId: INPUT.ownerUserId,
        sourceId: INPUT.sourceId,
        sourceType: INPUT.sourceType,
      }),
    ).resolves.toBe(true);

    expect(from).toHaveBeenNthCalledWith(1, "ai_embedding_active_generations");
    expect(from).toHaveBeenNthCalledWith(2, "ai_embeddings");

    expect(activeGenerationQuery.select).toHaveBeenCalledWith(
      "active_model_config_id, active_generation_id",
    );
    expect(activeGenerationQuery.eq).toHaveBeenCalledWith(
      "owner_user_id",
      INPUT.ownerUserId,
    );
    expect(activeGenerationQuery.eq).toHaveBeenCalledWith(
      "source_type",
      INPUT.sourceType,
    );
    expect(activeGenerationQuery.eq).toHaveBeenCalledWith(
      "source_id",
      INPUT.sourceId,
    );
    expect(activeGenerationQuery.eq).toHaveBeenCalledWith(
      "input_kind",
      INPUT.inputKind,
    );

    expect(activeEmbeddingQuery.select).toHaveBeenCalledWith("id");
    expect(activeEmbeddingQuery.eq).toHaveBeenCalledWith(
      "owner_user_id",
      INPUT.ownerUserId,
    );
    expect(activeEmbeddingQuery.eq).toHaveBeenCalledWith(
      "source_type",
      INPUT.sourceType,
    );
    expect(activeEmbeddingQuery.eq).toHaveBeenCalledWith(
      "source_id",
      INPUT.sourceId,
    );
    expect(activeEmbeddingQuery.eq).toHaveBeenCalledWith(
      "model_config_id",
      INPUT.modelConfigId,
    );
    expect(activeEmbeddingQuery.eq).toHaveBeenCalledWith(
      "input_kind",
      INPUT.inputKind,
    );
    expect(activeEmbeddingQuery.eq).toHaveBeenCalledWith(
      "generation_id",
      INPUT.generationId,
    );
    expect(activeEmbeddingQuery.eq).toHaveBeenCalledWith(
      "content_hash",
      CONTENT_HASH,
    );

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });

  it("활성 generation이 없으면 false를 반환하고 embedding row를 조회하지 않는다", async () => {
    const activeGenerationMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const activeGenerationQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: activeGenerationMaybeSingle,
    };

    activeGenerationQuery.select.mockReturnValue(activeGenerationQuery);
    activeGenerationQuery.eq.mockReturnValue(activeGenerationQuery);

    const from = vi.fn().mockReturnValue(activeGenerationQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as never);

    await expect(
      hasActiveAiEmbeddingGenerationForContent({
        contentHash: CONTENT_HASH,
        inputKind: INPUT.inputKind,
        modelConfigId: INPUT.modelConfigId,
        ownerUserId: INPUT.ownerUserId,
        sourceId: INPUT.sourceId,
        sourceType: INPUT.sourceType,
      }),
    ).resolves.toBe(false);

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("ai_embedding_active_generations");

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });

  it("활성 generation의 model이 현재 model과 다르면 false를 반환하고 embedding row를 조회하지 않는다", async () => {
    const activeGenerationMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        active_model_config_id: "66666666-6666-4666-8666-666666666666",
        active_generation_id: INPUT.generationId,
      },
      error: null,
    });

    const activeGenerationQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: activeGenerationMaybeSingle,
    };

    activeGenerationQuery.select.mockReturnValue(activeGenerationQuery);
    activeGenerationQuery.eq.mockReturnValue(activeGenerationQuery);

    const from = vi.fn().mockReturnValue(activeGenerationQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as never);

    await expect(
      hasActiveAiEmbeddingGenerationForContent({
        contentHash: CONTENT_HASH,
        inputKind: INPUT.inputKind,
        modelConfigId: INPUT.modelConfigId,
        ownerUserId: INPUT.ownerUserId,
        sourceId: INPUT.sourceId,
        sourceType: INPUT.sourceType,
      }),
    ).resolves.toBe(false);

    expect(from).toHaveBeenCalledTimes(1);

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });

  it("활성 generation에 동일 content hash의 embedding이 없으면 false를 반환한다", async () => {
    const activeGenerationMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        active_model_config_id: INPUT.modelConfigId,
        active_generation_id: INPUT.generationId,
      },
      error: null,
    });

    const activeGenerationQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: activeGenerationMaybeSingle,
    };

    activeGenerationQuery.select.mockReturnValue(activeGenerationQuery);
    activeGenerationQuery.eq.mockReturnValue(activeGenerationQuery);

    const activeEmbeddingMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const activeEmbeddingQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: activeEmbeddingMaybeSingle,
    };

    activeEmbeddingQuery.select.mockReturnValue(activeEmbeddingQuery);
    activeEmbeddingQuery.eq.mockReturnValue(activeEmbeddingQuery);
    activeEmbeddingQuery.limit.mockReturnValue(activeEmbeddingQuery);

    const from = vi
      .fn()
      .mockReturnValueOnce(activeGenerationQuery)
      .mockReturnValueOnce(activeEmbeddingQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as never);

    await expect(
      hasActiveAiEmbeddingGenerationForContent({
        contentHash: CONTENT_HASH,
        inputKind: INPUT.inputKind,
        modelConfigId: INPUT.modelConfigId,
        ownerUserId: INPUT.ownerUserId,
        sourceId: INPUT.sourceId,
        sourceType: INPUT.sourceType,
      }),
    ).resolves.toBe(false);

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });

  it("활성 generation 조회가 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const databaseError = {
      message: "active generation lookup failed",
    };

    const activeGenerationMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: databaseError,
    });

    const activeGenerationQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: activeGenerationMaybeSingle,
    };

    activeGenerationQuery.select.mockReturnValue(activeGenerationQuery);
    activeGenerationQuery.eq.mockReturnValue(activeGenerationQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(activeGenerationQuery),
    } as never);

    await expect(
      hasActiveAiEmbeddingGenerationForContent({
        contentHash: CONTENT_HASH,
        inputKind: INPUT.inputKind,
        modelConfigId: INPUT.modelConfigId,
        ownerUserId: INPUT.ownerUserId,
        sourceId: INPUT.sourceId,
        sourceType: INPUT.sourceType,
      }),
    ).rejects.toThrow(
      "Failed to read active AI embedding generation: active generation lookup failed",
    );

    expect(reportAiOperationalError).toHaveBeenCalledWith({
      error: databaseError,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_CACHE_READ_FAILED,
      message: "활성 AI embedding generation 조회에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.GET_EMBEDDING_CACHE,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      context: {
        inputKind: INPUT.inputKind,
        modelConfigId: INPUT.modelConfigId,
        sourceId: INPUT.sourceId,
        sourceType: INPUT.sourceType,
      },
    });
  });

  it("활성 generation의 embedding 조회가 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const activeGenerationMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        active_model_config_id: INPUT.modelConfigId,
        active_generation_id: INPUT.generationId,
      },
      error: null,
    });

    const activeGenerationQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: activeGenerationMaybeSingle,
    };

    activeGenerationQuery.select.mockReturnValue(activeGenerationQuery);
    activeGenerationQuery.eq.mockReturnValue(activeGenerationQuery);

    const databaseError = {
      message: "active embedding lookup failed",
    };

    const activeEmbeddingMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: databaseError,
    });

    const activeEmbeddingQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: activeEmbeddingMaybeSingle,
    };

    activeEmbeddingQuery.select.mockReturnValue(activeEmbeddingQuery);
    activeEmbeddingQuery.eq.mockReturnValue(activeEmbeddingQuery);
    activeEmbeddingQuery.limit.mockReturnValue(activeEmbeddingQuery);

    const from = vi
      .fn()
      .mockReturnValueOnce(activeGenerationQuery)
      .mockReturnValueOnce(activeEmbeddingQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as never);

    await expect(
      hasActiveAiEmbeddingGenerationForContent({
        contentHash: CONTENT_HASH,
        inputKind: INPUT.inputKind,
        modelConfigId: INPUT.modelConfigId,
        ownerUserId: INPUT.ownerUserId,
        sourceId: INPUT.sourceId,
        sourceType: INPUT.sourceType,
      }),
    ).rejects.toThrow(
      "Failed to read active AI embedding content: active embedding lookup failed",
    );

    expect(reportAiOperationalError).toHaveBeenCalledWith({
      error: databaseError,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_CACHE_READ_FAILED,
      message: "활성 AI embedding content 조회에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.GET_EMBEDDING_CACHE,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      context: {
        generationId: INPUT.generationId,
        inputKind: INPUT.inputKind,
        modelConfigId: INPUT.modelConfigId,
        sourceId: INPUT.sourceId,
        sourceType: INPUT.sourceType,
      },
    });
  });
});

describe("activateAiEmbeddingGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("완성된 generation과 source version을 전달하여 활성화 RPC를 호출한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as never);

    await expect(activateAiEmbeddingGeneration(INPUT)).resolves.toBeUndefined();

    expect(createAdminClient).toHaveBeenCalledTimes(1);

    expect(rpc).toHaveBeenCalledWith("activate_ai_embedding_generation", {
      p_generation_id: INPUT.generationId,
      p_input_kind: INPUT.inputKind,
      p_model_config_id: INPUT.modelConfigId,
      p_owner_user_id: INPUT.ownerUserId,
      p_source_id: INPUT.sourceId,
      p_source_type: INPUT.sourceType,
      p_source_updated_at: INPUT.sourceUpdatedAt,
    });

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });

  it("generation 활성화 RPC가 실패하면 source version을 포함해 운영 오류를 보고하고 예외를 던진다", async () => {
    const databaseError = {
      message: "generation activation failed",
    };

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: databaseError,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as never);

    await expect(activateAiEmbeddingGeneration(INPUT)).rejects.toThrow(
      "Failed to activate AI embedding generation: generation activation failed",
    );

    expect(reportAiOperationalError).toHaveBeenCalledWith({
      error: databaseError,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_ACTIVATION_FAILED,
      message: "AI embedding generation 활성화에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.ACTIVATE_EMBEDDING_GENERATION,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      context: {
        generationId: INPUT.generationId,
        inputKind: INPUT.inputKind,
        modelConfigId: INPUT.modelConfigId,
        sourceId: INPUT.sourceId,
        sourceType: INPUT.sourceType,
        sourceUpdatedAt: INPUT.sourceUpdatedAt,
      },
    });
  });
});
