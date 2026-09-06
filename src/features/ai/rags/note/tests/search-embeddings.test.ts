import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_EMBEDDING_DIMENSIONS } from "@/features/ai/constants/embeddings";
import { matchAiEmbeddings } from "@/features/ai/embeddings/match";
import { createAiEmbeddingWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";
import { reportAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import {
  NOTE_EMBEDDING_INPUT_KIND,
  NOTE_EMBEDDING_SOURCE_TYPE,
} from "../constants/embeddings";
import {
  searchNoteEmbeddings,
  searchNoteEmbeddingsWithUsage,
} from "../search-embeddings";

vi.mock("@/features/ai/embeddings/match", () => ({
  matchAiEmbeddings: vi.fn(),
}));

vi.mock("@/features/ai/providers", () => ({
  createAiEmbeddingWithProvider: vi.fn(),
}));

vi.mock("@/features/ai/providers/utils/api-key", () => ({
  getProviderApiKey: vi.fn(),
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

const SEARCH_INPUT = {
  embeddingConfiguration: EMBEDDING_CONFIGURATION,
  ownerUserId: "user-id",
  question: "다익스트라 알고리즘의 시간 복잡도는?",
  limit: 5,
  minSimilarity: 0.7,
};

describe("searchNoteEmbeddings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("검색 질의를 Embedding으로 변환하고 Note Embedding을 검색한다", async () => {
    const queryEmbedding = {
      embedding: [0.1, 0.2, 0.3],
    };

    const matchedEmbeddings = [
      {
        embedding_id: "embedding-id",
        similarity: 0.95,
        source_id: "note-id",
      },
    ];

    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");
    vi.mocked(createAiEmbeddingWithProvider).mockResolvedValue(
      queryEmbedding as never,
    );
    vi.mocked(matchAiEmbeddings).mockResolvedValue(matchedEmbeddings as never);

    const result = await searchNoteEmbeddings(SEARCH_INPUT);

    expect(getProviderApiKey).toHaveBeenCalledWith(
      EMBEDDING_CONFIGURATION.model.provider,
    );

    expect(createAiEmbeddingWithProvider).toHaveBeenCalledWith({
      apiKey: "test-api-key",
      dimensions: EMBEDDING_CONFIGURATION.model.dimensions,
      input: SEARCH_INPUT.question,
      model: EMBEDDING_CONFIGURATION.model.model,
      provider: EMBEDDING_CONFIGURATION.model.provider,
    });

    expect(matchAiEmbeddings).toHaveBeenCalledWith({
      excludeSourceIds: undefined,
      inputKind: NOTE_EMBEDDING_INPUT_KIND,
      limit: SEARCH_INPUT.limit,
      minSimilarity: SEARCH_INPUT.minSimilarity,
      modelConfigId: EMBEDDING_CONFIGURATION.model.id,
      ownerUserId: SEARCH_INPUT.ownerUserId,
      queryEmbedding: queryEmbedding.embedding,
      sourceType: NOTE_EMBEDDING_SOURCE_TYPE,
    });

    expect(result).toBe(matchedEmbeddings);
  });

  it("제외할 Note ID 목록이 지정되면 matchAiEmbeddings에 전달한다", async () => {
    const queryEmbedding = {
      embedding: [0.1, 0.2, 0.3],
    };

    const excludeSourceIds = ["excluded-note-id-1", "excluded-note-id-2"];

    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");
    vi.mocked(createAiEmbeddingWithProvider).mockResolvedValue(
      queryEmbedding as never,
    );
    vi.mocked(matchAiEmbeddings).mockResolvedValue([]);

    await searchNoteEmbeddings({
      ...SEARCH_INPUT,
      excludeSourceIds,
    });

    expect(matchAiEmbeddings).toHaveBeenCalledWith({
      excludeSourceIds,
      inputKind: NOTE_EMBEDDING_INPUT_KIND,
      limit: SEARCH_INPUT.limit,
      minSimilarity: SEARCH_INPUT.minSimilarity,
      modelConfigId: EMBEDDING_CONFIGURATION.model.id,
      ownerUserId: SEARCH_INPUT.ownerUserId,
      queryEmbedding: queryEmbedding.embedding,
      sourceType: NOTE_EMBEDDING_SOURCE_TYPE,
    });
  });

  it("지원하지 않는 Embedding dimensions이면 운영 오류를 기록하고 Provider를 호출하지 않는다", async () => {
    const configuration = {
      ...EMBEDDING_CONFIGURATION,
      model: {
        ...EMBEDDING_CONFIGURATION.model,
        dimensions: AI_EMBEDDING_DIMENSIONS + 1,
      },
    } as AiRuntimeEmbeddingConfiguration;

    await expect(
      searchNoteEmbeddings({
        ...SEARCH_INPUT,
        embeddingConfiguration: configuration,
      }),
    ).rejects.toThrow(
      `Unsupported note embedding dimensions: ${AI_EMBEDDING_DIMENSIONS + 1}`,
    );

    expect(reportAiOperationalError).toHaveBeenCalledOnce();
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_DIMENSIONS_UNSUPPORTED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
        stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      }),
    );

    expect(getProviderApiKey).not.toHaveBeenCalled();
    expect(createAiEmbeddingWithProvider).not.toHaveBeenCalled();
    expect(matchAiEmbeddings).not.toHaveBeenCalled();
  });

  it("Embedding dimensions 설정이 없으면 운영 오류를 기록하고 Provider를 호출하지 않는다", async () => {
    const configuration = {
      ...EMBEDDING_CONFIGURATION,
      model: {
        ...EMBEDDING_CONFIGURATION.model,
        dimensions: null,
      },
    } as AiRuntimeEmbeddingConfiguration;

    await expect(
      searchNoteEmbeddings({
        ...SEARCH_INPUT,
        embeddingConfiguration: configuration,
      }),
    ).rejects.toThrow(
      `Embedding 모델의 dimensions 설정이 없습니다: ${EMBEDDING_CONFIGURATION.model.id}`,
    );

    expect(reportAiOperationalError).toHaveBeenCalledOnce();
    expect(reportAiOperationalError).toHaveBeenCalledWith({
      context: {
        model: EMBEDDING_CONFIGURATION.model.model,
        modelConfigId: EMBEDDING_CONFIGURATION.model.id,
        provider: EMBEDDING_CONFIGURATION.model.provider,
      },
      error: expect.any(Error),
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_DIMENSIONS_MISSING,
      message: "AI embedding 모델의 dimensions 설정이 없습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });

    expect(getProviderApiKey).not.toHaveBeenCalled();
    expect(createAiEmbeddingWithProvider).not.toHaveBeenCalled();
    expect(matchAiEmbeddings).not.toHaveBeenCalled();
  });

  it("Provider API key가 없으면 운영 오류를 기록하고 Provider를 호출하지 않는다", async () => {
    const error = new Error("OPENAI_API_KEY is not configured.");

    vi.mocked(getProviderApiKey).mockImplementation(() => {
      throw error;
    });

    await expect(searchNoteEmbeddings(SEARCH_INPUT)).rejects.toThrow(error);

    expect(reportAiOperationalError).toHaveBeenCalledOnce();
    expect(reportAiOperationalError).toHaveBeenCalledWith({
      context: {
        model: EMBEDDING_CONFIGURATION.model.model,
        modelConfigId: EMBEDDING_CONFIGURATION.model.id,
        provider: EMBEDDING_CONFIGURATION.model.provider,
      },
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.PROVIDER_API_KEY_MISSING,
      message: "AI Provider API key 설정이 없습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });

    expect(createAiEmbeddingWithProvider).not.toHaveBeenCalled();
    expect(matchAiEmbeddings).not.toHaveBeenCalled();
  });

  it("DB 검색이 실패해도 Provider usage를 먼저 전달한다", async () => {
    const usage = {
      inputTokens: 7,
      outputTokens: 0,
      totalTokens: 7,
    };

    const onUsage = vi.fn().mockResolvedValue(undefined);

    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");
    vi.mocked(createAiEmbeddingWithProvider).mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
      metadata: {},
      usage,
    });
    vi.mocked(matchAiEmbeddings).mockRejectedValue(new Error("match failed"));

    await expect(
      searchNoteEmbeddingsWithUsage({
        ...SEARCH_INPUT,
        onUsage,
      }),
    ).rejects.toThrow("match failed");

    expect(onUsage).toHaveBeenCalledOnce();
    expect(onUsage).toHaveBeenCalledWith(usage);
  });

  it("embedding 완료 뒤 검색이 실패해도 vector 없는 완료 관측값을 보존한다", async () => {
    const usage = { inputTokens: 7, outputTokens: 0, totalTokens: 7 };
    const onObservation = vi.fn();

    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");
    vi.mocked(createAiEmbeddingWithProvider).mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
      metadata: { provider: "openai" },
      usage,
    });
    vi.mocked(matchAiEmbeddings).mockRejectedValue(new Error("match failed"));

    await expect(
      searchNoteEmbeddingsWithUsage({
        ...SEARCH_INPUT,
        onObservation,
      }),
    ).rejects.toThrow("match failed");

    expect(onObservation.mock.calls.map(([event]) => event.type)).toEqual([
      "embedding-requested",
      "embedding-completed",
      "search-requested",
      "search-failed",
    ]);
    const embeddingCompleted = onObservation.mock.calls[1]?.[0];
    expect(embeddingCompleted).toEqual({
      metadata: { provider: "openai" },
      type: "embedding-completed",
      usage,
    });
    expect(embeddingCompleted).not.toHaveProperty("embedding");
  });

  it("검색 완료 시 raw match 순서를 그대로 관측한다", async () => {
    const matches = [
      { embedding_id: "first", similarity: 0.9, source_id: "note-1" },
      { embedding_id: "second", similarity: 0.8, source_id: "note-2" },
    ];
    const onObservation = vi.fn();

    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");
    vi.mocked(createAiEmbeddingWithProvider).mockResolvedValue({
      embedding: [0.1],
      metadata: {},
      usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
    });
    vi.mocked(matchAiEmbeddings).mockResolvedValue(matches as never);

    const result = await searchNoteEmbeddingsWithUsage({
      ...SEARCH_INPUT,
      onObservation,
    });

    expect(result.matches).toBe(matches);
    expect(onObservation).toHaveBeenLastCalledWith({
      matches,
      type: "search-completed",
    });
  });

  it("관측 callback 실패가 기존 검색 결과와 호출 횟수를 바꾸지 않는다", async () => {
    const matches = [{ embedding_id: "id", source_id: "note-id" }];

    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");
    vi.mocked(createAiEmbeddingWithProvider).mockResolvedValue({
      embedding: [0.1],
      metadata: {},
      usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
    });
    vi.mocked(matchAiEmbeddings).mockResolvedValue(matches as never);

    await expect(
      searchNoteEmbeddings({
        ...SEARCH_INPUT,
        onObservation: vi.fn().mockRejectedValue(new Error("관측 실패")),
      }),
    ).resolves.toBe(matches);

    expect(createAiEmbeddingWithProvider).toHaveBeenCalledOnce();
    expect(matchAiEmbeddings).toHaveBeenCalledOnce();
  });
});
