import { afterEach, describe, expect, it, vi } from "vitest";

import { reportAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import { createOpenAiEmbedding } from "../embeddings";

const originalFetch = globalThis.fetch;

const baseParams = {
  apiKey: "test-api-key",
  dimensions: 3,
  input: "임베딩할 텍스트",
  model: "text-embedding-3-small",
};

vi.mock("@/features/ai/utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn(),
}));

/**
 * 테스트용 fetch 응답을 생성합니다.
 *
 * @param body JSON 응답 본문입니다.
 * @param options 응답 상태 설정입니다.
 * @returns fetch Response mock입니다.
 */
function createJsonResponse(
  body: unknown,
  options: {
    ok?: boolean;
    status?: number;
    text?: string;
  } = {},
) {
  return {
    json: vi.fn().mockResolvedValue(body),
    ok: options.ok ?? true,
    status: options.status ?? 200,
    text: vi.fn().mockResolvedValue(options.text ?? ""),
  } as unknown as Response;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("createOpenAiEmbedding", () => {
  it("Embedding 요청을 보내고 정규화된 결과를 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        data: [
          {
            embedding: [0.1, 0.2, 0.3],
          },
        ],
        model: "text-embedding-3-small",
        usage: {
          prompt_tokens: 10,
          total_tokens: 10,
        },
      }),
    );

    globalThis.fetch = fetchMock;

    const result = await createOpenAiEmbedding(baseParams);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      {
        body: JSON.stringify({
          dimensions: 3,
          input: "임베딩할 텍스트",
          model: "text-embedding-3-small",
        }),
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    expect(result).toEqual({
      embedding: [0.1, 0.2, 0.3],
      metadata: {
        provider: "openai",
        requestedModel: "text-embedding-3-small",
        responseModel: "text-embedding-3-small",
        usage: {
          inputTokens: 10,
          outputTokens: 0,
          totalTokens: 10,
        },
      },
      usage: {
        inputTokens: 10,
        outputTokens: 0,
        totalTokens: 10,
      },
    });
  });

  it("usage가 없으면 토큰 수를 0으로 반환한다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createJsonResponse({
        data: [
          {
            embedding: [0.1, 0.2, 0.3],
          },
        ],
      }),
    );

    const result = await createOpenAiEmbedding(baseParams);

    expect(result).toEqual({
      embedding: [0.1, 0.2, 0.3],
      metadata: {
        provider: "openai",
        requestedModel: "text-embedding-3-small",
        responseModel: null,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    });
  });

  it("total_tokens가 없으면 prompt_tokens를 사용한다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createJsonResponse({
        data: [
          {
            embedding: [0.1, 0.2, 0.3],
          },
        ],
        usage: {
          prompt_tokens: 7,
        },
      }),
    );

    const result = await createOpenAiEmbedding(baseParams);

    expect(result.usage).toEqual({
      inputTokens: 7,
      outputTokens: 0,
      totalTokens: 7,
    });
  });

  it("OpenAI 응답이 실패하면 운영 오류를 기록하고 상태와 응답 본문을 포함한 예외를 던진다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createJsonResponse(null, {
        ok: false,
        status: 429,
        text: "rate limit exceeded",
      }),
    );

    await expect(createOpenAiEmbedding(baseParams)).rejects.toThrow(
      "OpenAI embedding failed: 429 rate limit exceeded",
    );

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_EMBEDDING_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
      }),
    );
  });

  it("응답이 스키마와 일치하지 않으면 예외를 던진다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createJsonResponse({
        data: [],
      }),
    );

    await expect(createOpenAiEmbedding(baseParams)).rejects.toThrow();
  });

  it("빈 embedding을 반환하면 오류를 발생시킨다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createJsonResponse({
        data: [
          {
            embedding: [],
          },
        ],
        model: "text-embedding-3-small",
        usage: {
          prompt_tokens: 1,
          total_tokens: 1,
        },
      }),
    );

    await expect(createOpenAiEmbedding(baseParams)).rejects.toThrow(
      "OpenAI embedding returned empty values.",
    );
  });

  it("요청한 dimensions와 반환된 embedding 차원이 다르면 오류를 발생시킨다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createJsonResponse({
        data: [
          {
            embedding: [0.1, 0.2],
          },
        ],
        model: "text-embedding-3-small",
        usage: {
          prompt_tokens: 1,
          total_tokens: 1,
        },
      }),
    );

    await expect(createOpenAiEmbedding(baseParams)).rejects.toThrow(
      "OpenAI embedding dimension mismatch: expected 3, received 2.",
    );
  });
});
