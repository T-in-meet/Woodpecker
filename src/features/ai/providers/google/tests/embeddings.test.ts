import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import { createGoogleEmbedding } from "../embeddings";

vi.mock("@/features/ai/utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn().mockResolvedValue(undefined),
}));

const API_KEY = "google-api-key";
const MODEL = "gemini-embedding-001";
const INPUT = "임베딩을 생성할 테스트 문장입니다.";
const DIMENSIONS = 3;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createGoogleEmbedding", () => {
  it("Google Embeddings API를 호출하고 공통 응답 형식으로 변환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          embedding: {
            shape: [DIMENSIONS],
            values: [0.1, 0.2, 0.3],
          },
          usageMetadata: {
            promptTokenCount: 7,
            promptTokenDetails: [
              {
                modality: "TEXT",
                tokenCount: 7,
              },
            ],
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await createGoogleEmbedding({
      apiKey: API_KEY,
      dimensions: DIMENSIONS,
      input: INPUT,
      model: MODEL,
    });

    expect(fetchMock).toHaveBeenCalledOnce();

    expect(result).toEqual({
      embedding: [0.1, 0.2, 0.3],
      metadata: {
        provider: "google",
        requestedModel: MODEL,
        responseModel: MODEL,
        usage: {
          inputTokens: 7,
          outputTokens: 0,
          totalTokens: 7,
        },
      },
      usage: {
        inputTokens: 7,
        outputTokens: 0,
        totalTokens: 7,
      },
    });

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });

  it("usageMetadata가 없으면 토큰 사용량을 0으로 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          embedding: {
            values: [0.1, 0.2, 0.3],
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await createGoogleEmbedding({
      apiKey: API_KEY,
      dimensions: DIMENSIONS,
      input: INPUT,
      model: MODEL,
    });

    expect(result.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });

  it("API 응답이 실패하면 운영 오류를 한 번 기록하고 오류를 발생시킨다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("invalid api key", {
        status: 401,
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createGoogleEmbedding({
        apiKey: API_KEY,
        dimensions: DIMENSIONS,
        input: INPUT,
        model: MODEL,
      }),
    ).rejects.toThrow("Google embedding failed: 401 invalid api key");

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_EMBEDDING_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
          status: 401,
        },
      }),
    );
  });

  it("네트워크 요청이 실패하면 운영 오류를 기록하고 오류를 전달한다", async () => {
    const error = new Error("network failed");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));

    await expect(
      createGoogleEmbedding({
        apiKey: API_KEY,
        dimensions: DIMENSIONS,
        input: INPUT,
        model: MODEL,
      }),
    ).rejects.toThrow("network failed");

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_EMBEDDING_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
        },
      }),
    );
  });

  it("빈 Embedding values가 반환되면 운영 오류를 기록하고 오류를 전달한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          embedding: {
            values: [],
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createGoogleEmbedding({
        apiKey: API_KEY,
        dimensions: DIMENSIONS,
        input: INPUT,
        model: MODEL,
      }),
    ).rejects.toThrow("Google embedding returned empty values.");

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_EMBEDDING_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
          status: 200,
        },
      }),
    );
  });

  it("응답 Embedding 차원이 요청한 차원과 다르면 운영 오류를 기록하고 오류를 전달한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          embedding: {
            values: [0.1, 0.2],
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createGoogleEmbedding({
        apiKey: API_KEY,
        dimensions: DIMENSIONS,
        input: INPUT,
        model: MODEL,
      }),
    ).rejects.toThrow(
      "Google embedding dimension mismatch: expected 3, received 2.",
    );

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_EMBEDDING_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
          status: 200,
        },
      }),
    );
  });

  it("Google 응답이 Embedding 스키마와 다르면 운영 오류를 기록하고 예외를 던진다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          embedding: {
            values: [0.1, "invalid", 0.3],
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createGoogleEmbedding({
        apiKey: API_KEY,
        dimensions: DIMENSIONS,
        input: INPUT,
        model: MODEL,
      }),
    ).rejects.toThrow();

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_EMBEDDING_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
          status: 200,
        },
      }),
    );
  });
});
