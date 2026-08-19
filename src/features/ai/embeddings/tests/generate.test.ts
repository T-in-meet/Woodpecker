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

const GENERATION_ID = "55555555-5555-4555-8555-555555555555";

const CONTENT_HASH = "note-content-hash";

const INPUT = {
  chunkCount: 2,
  chunkIndex: 0,
  contentHash: CONTENT_HASH,
  generationId: GENERATION_ID,
  ownerUserId: "user-id",
  sourceType: "note",
  sourceId: "note-id",
  inputKind: "rag_note_content",
  inputText: "Title:\nTest Note\n\nContent:\nTest content",
  inputPreview: "Title: Test Note",
};

const INPUT_HASH =
  "08134918c0a20280867d115ef0e1a8218e1ed6faf95b4a1f7dbc0d10c56bd6b1";

const CACHE_VECTOR = Array.from(
  { length: AI_EMBEDDING_DIMENSIONS },
  (_, index) => (index === 0 ? 1 : 0),
);

const CACHE_VECTOR_LITERAL = `[${CACHE_VECTOR.join(",")}]`;

describe("generateAiEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cache hit이면 기존 vector를 재사용해 새 generation row를 저장하고 Provider를 호출하지 않는다", async () => {
    const cachedEmbedding = {
      embedding: CACHE_VECTOR_LITERAL,
      token_count: 10,
    } as never;

    const insertedEmbedding = {
      id: "new-generation-embedding-id",
    } as never;

    vi.mocked(getAiEmbeddingCache).mockResolvedValue(cachedEmbedding);
    vi.mocked(insertAiEmbedding).mockResolvedValue(insertedEmbedding);

    const result = await generateAiEmbedding({
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      ...INPUT,
    });

    expect(result).toBe(insertedEmbedding);

    expect(getAiEmbeddingCache).toHaveBeenCalledWith({
      chunkCount: INPUT.chunkCount,
      chunkIndex: INPUT.chunkIndex,
      contentHash: CONTENT_HASH,
      generationId: INPUT.generationId,
      inputHash: INPUT_HASH,
      inputKind: INPUT.inputKind,
      inputPreview: INPUT.inputPreview,
      inputText: INPUT.inputText,
      modelConfigId: EMBEDDING_CONFIGURATION.model.id,
      ownerUserId: INPUT.ownerUserId,
      sourceId: INPUT.sourceId,
      sourceType: INPUT.sourceType,
    });

    expect(insertAiEmbedding).toHaveBeenCalledWith({
      chunkCount: INPUT.chunkCount,
      chunkIndex: INPUT.chunkIndex,
      contentHash: CONTENT_HASH,
      generationId: INPUT.generationId,
      inputHash: INPUT_HASH,
      inputKind: INPUT.inputKind,
      inputPreview: INPUT.inputPreview,
      inputText: INPUT.inputText,
      modelConfigId: EMBEDDING_CONFIGURATION.model.id,
      ownerUserId: INPUT.ownerUserId,
      sourceId: INPUT.sourceId,
      sourceType: INPUT.sourceType,
      embedding: CACHE_VECTOR,
      tokenCount: 10,
    });

    expect(getProviderApiKey).not.toHaveBeenCalled();
    expect(createAiEmbeddingWithProvider).not.toHaveBeenCalled();
  });

  it("cache miss이면 Provider로 embedding을 생성하고 현재 generation row에 저장한다", async () => {
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
      chunkCount: INPUT.chunkCount,
      chunkIndex: INPUT.chunkIndex,
      contentHash: CONTENT_HASH,
      generationId: INPUT.generationId,
      inputHash: INPUT_HASH,
      inputKind: INPUT.inputKind,
      inputPreview: INPUT.inputPreview,
      inputText: INPUT.inputText,
      modelConfigId: EMBEDDING_CONFIGURATION.model.id,
      ownerUserId: INPUT.ownerUserId,
      sourceId: INPUT.sourceId,
      sourceType: INPUT.sourceType,
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
    } as AiRuntimeEmbeddingConfiguration;

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

  it("cache hit이면 dimensions가 없어도 Provider 호출 없이 기존 vector를 새 generation에 저장한다", async () => {
    const configuration = {
      ...EMBEDDING_CONFIGURATION,
      model: {
        ...EMBEDDING_CONFIGURATION.model,
        dimensions: null,
      },
    } as AiRuntimeEmbeddingConfiguration;

    const cachedEmbedding = {
      embedding: CACHE_VECTOR_LITERAL,
      token_count: 10,
    } as never;

    const insertedEmbedding = {
      id: "new-generation-embedding-id",
    } as never;

    vi.mocked(getAiEmbeddingCache).mockResolvedValue(cachedEmbedding);
    vi.mocked(insertAiEmbedding).mockResolvedValue(insertedEmbedding);

    const result = await generateAiEmbedding({
      embeddingConfiguration: configuration,
      ...INPUT,
    });

    expect(result).toBe(insertedEmbedding);

    expect(insertAiEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: INPUT.generationId,
        chunkIndex: INPUT.chunkIndex,
        chunkCount: INPUT.chunkCount,
        embedding: CACHE_VECTOR,
        tokenCount: 10,
      }),
    );

    expect(getProviderApiKey).not.toHaveBeenCalled();
    expect(createAiEmbeddingWithProvider).not.toHaveBeenCalled();
  });
});
