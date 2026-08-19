import { describe, expect, it } from "vitest";

import type { AiEmbeddingTokenizer } from "@/features/ai/embeddings/tokenizer";

import { createNoteContentChunks } from "../chunk";

const tokenizer: AiEmbeddingTokenizer = {
  encode(text) {
    return text.split("").map((character) => character.charCodeAt(0));
  },

  decode(tokens) {
    return String.fromCharCode(...tokens);
  },
};

describe("createNoteContentChunks", () => {
  it("token 수가 limit 이하이면 원문을 하나의 chunk로 반환한다", () => {
    const chunks = createNoteContentChunks({
      content: "abcd",
      policy: {
        chunkTokenLimit: 4,
        overlapTokens: 1,
      },
      tokenizer,
    });

    expect(chunks).toEqual(["abcd"]);
  });

  it("token 수가 limit을 초과하면 여러 chunk로 분할한다", () => {
    const chunks = createNoteContentChunks({
      content: "abcdefghij",
      policy: {
        chunkTokenLimit: 4,
        overlapTokens: 0,
      },
      tokenizer,
    });

    expect(chunks).toEqual(["abcd", "efgh", "ij"]);
  });

  it("인접 chunk 사이에 지정한 token overlap을 적용한다", () => {
    const chunks = createNoteContentChunks({
      content: "abcdefghij",
      policy: {
        chunkTokenLimit: 4,
        overlapTokens: 1,
      },
      tokenizer,
    });

    expect(chunks).toEqual(["abcd", "defg", "ghij"]);
  });

  it("빈 content이면 빈 chunk 목록을 반환한다", () => {
    const chunks = createNoteContentChunks({
      content: "",
      policy: {
        chunkTokenLimit: 4,
        overlapTokens: 1,
      },
      tokenizer,
    });

    expect(chunks).toEqual([]);
  });

  it.each([0, -1])(
    "chunkTokenLimit이 유효하지 않은 값 %s이면 거부한다",
    (chunkTokenLimit) => {
      expect(() =>
        createNoteContentChunks({
          content: "abcdefghij",
          policy: {
            chunkTokenLimit,
            overlapTokens: 0,
          },
          tokenizer,
        }),
      ).toThrow("Note chunk token limit must be greater than 0.");
    },
  );

  it("overlapTokens가 음수이면 거부한다", () => {
    expect(() =>
      createNoteContentChunks({
        content: "abcdefghij",
        policy: {
          chunkTokenLimit: 4,
          overlapTokens: -1,
        },
        tokenizer,
      }),
    ).toThrow("Note chunk overlap must not be negative.");
  });

  it("overlapTokens가 chunkTokenLimit 이상이면 거부한다", () => {
    expect(() =>
      createNoteContentChunks({
        content: "abcdefghij",
        policy: {
          chunkTokenLimit: 4,
          overlapTokens: 4,
        },
        tokenizer,
      }),
    ).toThrow("Note chunk overlap must be smaller than the chunk token limit.");
  });
});
