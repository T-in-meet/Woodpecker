import { describe, expect, it } from "vitest";

import {
  openAiChatCompletionResponseSchema,
  openAiEmbeddingResponseSchema,
} from "../schema";

describe("openAiChatCompletionResponseSchema", () => {
  it("유효한 Chat Completion 응답을 허용한다", () => {
    const response = {
      choices: [
        {
          message: {
            content: "응답 내용",
          },
        },
      ],
      usage: {
        completion_tokens: 20,
        prompt_tokens: 10,
        total_tokens: 30,
      },
    };

    expect(openAiChatCompletionResponseSchema.parse(response)).toEqual(
      response,
    );
  });

  it("message content의 null 값을 허용한다", () => {
    expect(
      openAiChatCompletionResponseSchema.parse({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      }),
    ).toEqual({
      choices: [
        {
          message: {
            content: null,
          },
        },
      ],
    });
  });

  it("usage가 없어도 허용한다", () => {
    expect(
      openAiChatCompletionResponseSchema.safeParse({
        choices: [
          {
            message: {
              content: "응답",
            },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("choices가 비어 있으면 거부한다", () => {
    expect(
      openAiChatCompletionResponseSchema.safeParse({
        choices: [],
      }).success,
    ).toBe(false);
  });

  it.each([
    {
      completion_tokens: -1,
    },
    {
      prompt_tokens: 1.5,
    },
    {
      total_tokens: -1,
    },
  ])("유효하지 않은 usage 토큰 값을 거부한다", (usage) => {
    expect(
      openAiChatCompletionResponseSchema.safeParse({
        choices: [
          {
            message: {
              content: "응답",
            },
          },
        ],
        usage,
      }).success,
    ).toBe(false);
  });
});

describe("openAiEmbeddingResponseSchema", () => {
  it("유효한 Embedding 응답을 허용한다", () => {
    const response = {
      data: [
        {
          embedding: [0.1, 0.2, 0.3],
        },
      ],
      usage: {
        prompt_tokens: 10,
        total_tokens: 10,
      },
    };

    expect(openAiEmbeddingResponseSchema.parse(response)).toEqual(response);
  });

  it("usage가 없어도 허용한다", () => {
    expect(
      openAiEmbeddingResponseSchema.safeParse({
        data: [
          {
            embedding: [0.1, 0.2],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("data가 비어 있으면 거부한다", () => {
    expect(
      openAiEmbeddingResponseSchema.safeParse({
        data: [],
      }).success,
    ).toBe(false);
  });

  it("embedding 배열에 숫자가 아닌 값이 있으면 거부한다", () => {
    expect(
      openAiEmbeddingResponseSchema.safeParse({
        data: [
          {
            embedding: [0.1, "0.2"],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it.each([
    {
      prompt_tokens: -1,
    },
    {
      total_tokens: 1.5,
    },
  ])("유효하지 않은 usage 토큰 값을 거부한다", (usage) => {
    expect(
      openAiEmbeddingResponseSchema.safeParse({
        data: [
          {
            embedding: [0.1, 0.2],
          },
        ],
        usage,
      }).success,
    ).toBe(false);
  });
});
