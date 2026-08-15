import { describe, expect, it, vi } from "vitest";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import { AI_EMBEDDING_DIMENSIONS } from "../../constants/embeddings";
import { AI_MODEL_CAPABILITY } from "../../constants/models";
import { reportAiOperationalError } from "../../utils/report-ai-operational-error";
import { getActiveAiModelConfigById } from "../queries";

vi.mock("../../utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn(),
}));

const MODEL_CONFIG_ID = "44444444-4444-4444-8444-444444444444";

const MODEL_CONFIG_ROW = {
  id: MODEL_CONFIG_ID,
  display_name: "OpenAI Chat",
  provider: "openai",
  model: "gpt-test",
  capability: AI_MODEL_CAPABILITY.CHAT,
  dimensions: null,
  distance_metric: null,
  is_active: true,
  notes: null,
  created_at: "2026-08-06T00:00:00.000Z",
  updated_at: "2026-08-06T00:00:00.000Z",
};

/**
 * AI Model Config 조회에 사용할 Supabase Client Mock을 생성합니다.
 *
 * @param result Model Config 단건 조회 결과입니다.
 * @returns 조회 함수에 주입할 Supabase Client Mock입니다.
 */
function createModelConfigClientMock(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);

  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle,
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  const from = vi.fn().mockReturnValue(query);

  return {
    client: { from } as never,
    from,
  };
}

describe("getActiveAiModelConfigById", () => {
  it("활성 Model Config를 ID로 조회하고 capability를 검증한다", async () => {
    const { client, from } = createModelConfigClientMock({
      data: MODEL_CONFIG_ROW,
      error: null,
    });

    const result = await getActiveAiModelConfigById({
      expectedCapability: AI_MODEL_CAPABILITY.CHAT,
      modelConfigId: MODEL_CONFIG_ID,
      supabase: client,
    });

    expect(from).toHaveBeenCalledWith("ai_model_configs");
    expect(result).toEqual(MODEL_CONFIG_ROW);
  });

  it("Model Config가 존재하지 않으면 오류를 발생시킨다", async () => {
    const { client } = createModelConfigClientMock({
      data: null,
      error: null,
    });

    await expect(
      getActiveAiModelConfigById({
        expectedCapability: AI_MODEL_CAPABILITY.CHAT,
        modelConfigId: MODEL_CONFIG_ID,
        supabase: client,
      }),
    ).rejects.toThrow(`AI model config not found: ${MODEL_CONFIG_ID}`);
  });

  it("Model Config 조회가 실패하면 운영 오류를 보고하고 데이터베이스 오류를 전달한다", async () => {
    const { client } = createModelConfigClientMock({
      data: null,
      error: {
        message: "Model query failed",
      },
    });

    await expect(
      getActiveAiModelConfigById({
        expectedCapability: AI_MODEL_CAPABILITY.CHAT,
        modelConfigId: MODEL_CONFIG_ID,
        supabase: client,
      }),
    ).rejects.toThrow("Failed to load AI model config: Model query failed");

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: "Model query failed",
        }),
        errorCode: AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_LOAD_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      }),
    );
  });

  it("비활성 Model Config이면 오류를 발생시킨다", async () => {
    const { client } = createModelConfigClientMock({
      data: {
        ...MODEL_CONFIG_ROW,
        is_active: false,
      },
      error: null,
    });

    await expect(
      getActiveAiModelConfigById({
        expectedCapability: AI_MODEL_CAPABILITY.CHAT,
        modelConfigId: MODEL_CONFIG_ID,
        supabase: client,
      }),
    ).rejects.toThrow(`AI model config is inactive: ${MODEL_CONFIG_ID}`);
  });

  it("요구한 capability와 다르면 오류를 발생시킨다", async () => {
    const { client } = createModelConfigClientMock({
      data: {
        ...MODEL_CONFIG_ROW,
        capability: AI_MODEL_CAPABILITY.EMBEDDING,
        dimensions: AI_EMBEDDING_DIMENSIONS,
        distance_metric: "cosine",
      },
      error: null,
    });

    await expect(
      getActiveAiModelConfigById({
        expectedCapability: AI_MODEL_CAPABILITY.CHAT,
        modelConfigId: MODEL_CONFIG_ID,
        supabase: client,
      }),
    ).rejects.toThrow(
      `AI model config capability mismatch: ${MODEL_CONFIG_ID} expected ${AI_MODEL_CAPABILITY.CHAT}`,
    );
  });

  it("요구한 embedding dimensions와 다르면 오류를 발생시킨다", async () => {
    const { client } = createModelConfigClientMock({
      data: {
        ...MODEL_CONFIG_ROW,
        capability: AI_MODEL_CAPABILITY.EMBEDDING,
        dimensions: 768,
        distance_metric: "cosine",
      },
      error: null,
    });

    await expect(
      getActiveAiModelConfigById({
        expectedCapability: AI_MODEL_CAPABILITY.EMBEDDING,
        expectedDimensions: AI_EMBEDDING_DIMENSIONS,
        modelConfigId: MODEL_CONFIG_ID,
        supabase: client,
      }),
    ).rejects.toThrow(
      `AI model config dimensions mismatch: ${MODEL_CONFIG_ID} expected ${AI_EMBEDDING_DIMENSIONS}`,
    );
  });

  it("요구한 embedding dimensions와 같으면 조회 결과를 반환한다", async () => {
    const embeddingModel = {
      ...MODEL_CONFIG_ROW,
      capability: AI_MODEL_CAPABILITY.EMBEDDING,
      dimensions: AI_EMBEDDING_DIMENSIONS,
      distance_metric: "cosine",
    };

    const { client } = createModelConfigClientMock({
      data: embeddingModel,
      error: null,
    });

    const result = await getActiveAiModelConfigById({
      expectedCapability: AI_MODEL_CAPABILITY.EMBEDDING,
      expectedDimensions: AI_EMBEDDING_DIMENSIONS,
      modelConfigId: MODEL_CONFIG_ID,
      supabase: client,
    });

    expect(result).toEqual(embeddingModel);
  });
});
