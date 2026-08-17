import { describe, expect, it } from "vitest";

import { createDefaultAiEmbeddingTokenizer } from "../tokenizer";

describe("createDefaultAiEmbeddingTokenizer", () => {
  it("텍스트를 token으로 변환하고 다시 원문으로 복원한다", () => {
    const tokenizer = createDefaultAiEmbeddingTokenizer();
    const text = "안녕하세요. Note embedding 테스트입니다.";

    const tokens = tokenizer.encode(text);

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokenizer.decode(tokens)).toBe(text);
  });
});
