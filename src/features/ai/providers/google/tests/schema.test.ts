import { describe, expect, it } from "vitest";

import {
  googleChatCompletionResponseSchema,
  googleEmbeddingResponseSchema,
} from "../schema";

describe("googleChatCompletionResponseSchema", () => {
  it("Google Chat 응답을 파싱한다", () => {
    const response = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "테스트 응답입니다.",
              },
            ],
            role: "model",
          },
          finishReason: "STOP",
          index: 0,
        },
      ],
      modelVersion: "gemini-2.5-flash",
      responseId: "response-id",
      usageMetadata: {
        cachedContentTokenCount: 2,
        candidatesTokenCount: 5,
        promptTokenCount: 10,
        thoughtsTokenCount: 3,
        totalTokenCount: 18,
      },
    };

    const result = googleChatCompletionResponseSchema.parse(response);

    expect(result).toEqual(response);
  });

  it("Prompt가 차단되어 candidates가 없는 응답을 파싱한다", () => {
    const response = {
      promptFeedback: {
        blockReason: "SAFETY",
        blockReasonMessage: "The prompt was blocked.",
      },
      usageMetadata: {
        promptTokenCount: 10,
        totalTokenCount: 10,
      },
    };

    const result = googleChatCompletionResponseSchema.parse(response);

    expect(result).toEqual(response);
  });

  it("Chat 응답의 text가 문자열이 아니면 파싱에 실패한다", () => {
    const response = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 123,
              },
            ],
          },
        },
      ],
    };

    expect(() => googleChatCompletionResponseSchema.parse(response)).toThrow();
  });

  it("생각을 나타내는 text 없는 part를 파싱한다", () => {
    const response = {
      candidates: [
        {
          content: {
            parts: [
              {
                thought: true,
              },
              {
                text: "최종 응답",
              },
            ],
          },
        },
      ],
    };

    const result = googleChatCompletionResponseSchema.parse(response);

    expect(result).toEqual(response);
  });
});

describe("googleEmbeddingResponseSchema", () => {
  it("Google Embedding 응답을 파싱한다", () => {
    const response = {
      embedding: {
        shape: [3],
        values: [0.1, 0.2, 0.3],
      },
      usageMetadata: {
        promptTokenCount: 5,
        promptTokenDetails: [
          {
            modality: "TEXT",
            tokenCount: 5,
          },
        ],
      },
    };

    const result = googleEmbeddingResponseSchema.parse(response);

    expect(result).toEqual(response);
  });

  it("선택 필드 없이 Embedding 응답을 파싱한다", () => {
    const response = {
      embedding: {
        values: [0.1, 0.2, 0.3],
      },
    };

    const result = googleEmbeddingResponseSchema.parse(response);

    expect(result).toEqual(response);
  });

  it("Embedding values에 숫자가 아닌 값이 있으면 파싱에 실패한다", () => {
    const response = {
      embedding: {
        values: [0.1, "invalid", 0.3],
      },
    };

    expect(() => googleEmbeddingResponseSchema.parse(response)).toThrow();
  });

  it("embedding 필드가 없으면 파싱에 실패한다", () => {
    const response = {
      usageMetadata: {
        promptTokenCount: 5,
      },
    };

    expect(() => googleEmbeddingResponseSchema.parse(response)).toThrow();
  });
});
