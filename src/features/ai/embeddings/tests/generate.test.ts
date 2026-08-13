import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAiEmbeddingWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";
import { reportAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import { AI_EMBEDDING_DIMENSIONS } from "../../constants/embeddings";
import { getAiEmbeddingCache, insertAiEmbedding } from "../cache";
import { generateAiEmbedding } from "../generate";

vi.mock("@/features/ai/providers", () => ({
  createAiEmbeddingWithProvider: vi.fn(),
}));

vi.mock("@/features/ai/providers/utils/api-key", () => ({
  getProviderApiKey: vi.fn(),
}));

vi.mock("../cache", () => ({
  getAiEmbeddingCache: vi.fn(),
  insertAiEmbedding: vi.fn(),
}));

vi.mock("@/features/ai/utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn(),
}));

const EMBEDDING_CONFIGURATION = {
  model: {
    id: "embedding-model-id",
    provider: "openai",
    model: "text-embedding-3-small",
    dimensions: AI_EMBEDDING_DIMENSIONS,
  },
} as AiRuntimeEmbeddingConfiguration;

const INPUT = {
  ownerUserId: "user-id",
  sourceType: "note",
  sourceId: "note-id",
  inputKind: "rag_note_content",
  inputText: "Title:\nTest Note\n\nContent:\nTest content",
  inputPreview: "Title: Test Note",
};

describe("generateAiEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cache hit이면 기존 embedding을 반환하고 Provider를 호출하지 않는다", async () => {
    const cachedEmbedding = {
      id: "embedding-id",
    } as never;

    vi.mocked(getAiEmbeddingCache).mockResolvedValue(cachedEmbedding);

    const result = await generateAiEmbedding({
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      ...INPUT,
    });

    expect(result).toBe(cachedEmbedding);

    expect(getAiEmbeddingCache).toHaveBeenCalledWith({
      ownerUserId: INPUT.ownerUserId,
      sourceType: INPUT.sourceType,
      sourceId: INPUT.sourceId,
      modelConfigId: EMBEDDING_CONFIGURATION.model.id,
      inputKind: INPUT.inputKind,
      contentHash:
        "08134918c0a20280867d115ef0e1a8218e1ed6faf95b4a1f7dbc0d10c56bd6b1",
      inputHash:
        "08134918c0a20280867d115ef0e1a8218e1ed6faf95b4a1f7dbc0d10c56bd6b1",
      inputText: INPUT.inputText,
      inputPreview: INPUT.inputPreview,
    });

    expect(createAiEmbeddingWithProvider).not.toHaveBeenCalled();
    expect(getProviderApiKey).not.toHaveBeenCalled();
    expect(insertAiEmbedding).not.toHaveBeenCalled();
  });

  it("cache miss이면 Provider로 embedding을 생성하고 cache에 저장한다", async () => {
    const generatedEmbedding = {
      embedding: [0.1, 0.2, 0.3],
      metadata: {},
      usage: {
        inputTokens: 3,
        outputTokens: 0,
        totalTokens: 3,
      },
    };

    const insertedEmbedding = {
      id: "embedding-id",
    } as never;

    vi.mocked(getAiEmbeddingCache).mockResolvedValue(null);
    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");
    vi.mocked(createAiEmbeddingWithProvider).mockResolvedValue(
      generatedEmbedding,
    );
    vi.mocked(insertAiEmbedding).mockResolvedValue(insertedEmbedding);

    const result = await generateAiEmbedding({
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      ...INPUT,
    });

    expect(result).toBe(insertedEmbedding);

    expect(getProviderApiKey).toHaveBeenCalledWith(
      EMBEDDING_CONFIGURATION.model.provider,
    );

    expect(createAiEmbeddingWithProvider).toHaveBeenCalledWith({
      apiKey: "test-api-key",
      dimensions: EMBEDDING_CONFIGURATION.model.dimensions,
      input: INPUT.inputText,
      model: EMBEDDING_CONFIGURATION.model.model,
      provider: EMBEDDING_CONFIGURATION.model.provider,
    });

    expect(insertAiEmbedding).toHaveBeenCalledWith({
      ownerUserId: INPUT.ownerUserId,
      sourceType: INPUT.sourceType,
      sourceId: INPUT.sourceId,
      modelConfigId: EMBEDDING_CONFIGURATION.model.id,
      inputKind: INPUT.inputKind,
      contentHash:
        "08134918c0a20280867d115ef0e1a8218e1ed6faf95b4a1f7dbc0d10c56bd6b1",
      inputHash:
        "08134918c0a20280867d115ef0e1a8218e1ed6faf95b4a1f7dbc0d10c56bd6b1",
      inputText: INPUT.inputText,
      inputPreview: INPUT.inputPreview,
      embedding: generatedEmbedding.embedding,
      tokenCount: generatedEmbedding.usage.totalTokens,
    });
  });

  it("cache miss에서 dimensions가 없으면 Provider를 호출하지 않고 오류를 발생시킨다", async () => {
    const configuration = {
      ...EMBEDDING_CONFIGURATION,
      model: {
        ...EMBEDDING_CONFIGURATION.model,
        dimensions: null,
      },
    } as AiRuntimeEmbeddingConfiguration;

    vi.mocked(getAiEmbeddingCache).mockResolvedValue(null);

    await expect(
      generateAiEmbedding({
        embeddingConfiguration: configuration,
        ...INPUT,
      }),
    ).rejects.toThrow(
      "Embedding 모델의 dimensions 설정이 없습니다: embedding-model-id",
    );

    expect(getAiEmbeddingCache).toHaveBeenCalled();
    expect(getProviderApiKey).not.toHaveBeenCalled();
    expect(createAiEmbeddingWithProvider).not.toHaveBeenCalled();
    expect(insertAiEmbedding).not.toHaveBeenCalled();

    expect(reportAiOperationalError).toHaveBeenCalledWith({
      error: expect.objectContaining({
        message:
          "Embedding 모델의 dimensions 설정이 없습니다: embedding-model-id",
      }),
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_DIMENSIONS_MISSING,
      message: "AI embedding 모델의 dimensions 설정이 없습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      context: {
        modelConfigId: "embedding-model-id",
        model: "text-embedding-3-small",
        provider: "openai",
      },
    });
  });

  it("cache miss에서 지원하지 않는 dimensions이면 Provider를 호출하지 않고 오류를 발생시킨다", async () => {
    const configuration = {
      ...EMBEDDING_CONFIGURATION,
      model: {
        ...EMBEDDING_CONFIGURATION.model,
        dimensions: 768,
      },
    } as AiEmbeddingRuntimeConfiguration;

    vi.mocked(getAiEmbeddingCache).mockResolvedValue(null);

    await expect(
      generateAiEmbedding({
        embeddingConfiguration: configuration,
        ...INPUT,
      }),
    ).rejects.toThrow("현재 지원하지 않는 Embedding dimensions입니다: 768");

    expect(getAiEmbeddingCache).toHaveBeenCalled();
    expect(getProviderApiKey).not.toHaveBeenCalled();
    expect(createAiEmbeddingWithProvider).not.toHaveBeenCalled();
    expect(insertAiEmbedding).not.toHaveBeenCalled();

    expect(reportAiOperationalError).toHaveBeenCalledWith({
      error: expect.objectContaining({
        message: "현재 지원하지 않는 Embedding dimensions입니다: 768",
      }),
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_DIMENSIONS_UNSUPPORTED,
      message: "현재 지원하지 않는 AI embedding dimensions입니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      context: {
        modelConfigId: "embedding-model-id",
        model: "text-embedding-3-small",
        provider: "openai",
        dimensions: 768,
        supportedDimensions: AI_EMBEDDING_DIMENSIONS,
      },
    });
  });

  it("cache hit이면 dimensions가 없어도 기존 embedding을 반환한다", async () => {
    const configuration = {
      ...EMBEDDING_CONFIGURATION,
      model: {
        ...EMBEDDING_CONFIGURATION.model,
        dimensions: null,
      },
    } as AiRuntimeEmbeddingConfiguration;

    const cachedEmbedding = {
      id: "embedding-id",
    } as never;

    vi.mocked(getAiEmbeddingCache).mockResolvedValue(cachedEmbedding);

    const result = await generateAiEmbedding({
      embeddingConfiguration: configuration,
      ...INPUT,
    });

    expect(result).toBe(cachedEmbedding);
    expect(createAiEmbeddingWithProvider).not.toHaveBeenCalled();
    expect(insertAiEmbedding).not.toHaveBeenCalled();
  });
});
