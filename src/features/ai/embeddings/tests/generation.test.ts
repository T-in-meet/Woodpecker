import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { reportAiOperationalError } from "../../utils/report-ai-operational-error";
import { activateAiEmbeddingGeneration } from "../generation";

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
