import { describe, expect, it } from "vitest";

import { aiEmbeddingMatchRowSchema, aiEmbeddingRowSchema } from "../schema";

const EMBEDDING_ID = "11111111-1111-4111-8111-111111111111";
const MODEL_CONFIG_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_USER_ID = "33333333-3333-4333-8333-333333333333";
const SOURCE_ID = "44444444-4444-4444-8444-444444444444";

describe("aiEmbeddingRowSchema", () => {
  const validRow = {
    content_hash: "content-hash",
    created_at: "2026-08-04T00:00:00.000Z",
    embedding: "[0,0,0]",
    id: EMBEDDING_ID,
    input_hash: "input-hash",
    input_kind: "rag_note_content",
    input_preview: "노트 미리보기",
    input_text: "노트 전체 내용",
    model_config_id: MODEL_CONFIG_ID,
    owner_user_id: OWNER_USER_ID,
    source_id: SOURCE_ID,
    source_type: "note",
    token_count: 120,
  };

  it("유효한 embedding row를 허용한다", () => {
    expect(aiEmbeddingRowSchema.parse(validRow)).toEqual(validRow);
  });

  it("token_count의 null 값을 허용한다", () => {
    expect(
      aiEmbeddingRowSchema.parse({
        ...validRow,
        token_count: null,
      }).token_count,
    ).toBeNull();
  });

  it.each([
    ["id", "invalid-id"],
    ["model_config_id", "invalid-id"],
    ["owner_user_id", "invalid-id"],
    ["source_id", "invalid-id"],
  ] as const)("유효하지 않은 UUID 필드 %s를 거부한다", (field, value) => {
    expect(
      aiEmbeddingRowSchema.safeParse({
        ...validRow,
        [field]: value,
      }).success,
    ).toBe(false);
  });

  it.each([
    "content_hash",
    "input_hash",
    "input_kind",
    "input_preview",
    "input_text",
    "source_type",
  ] as const)("필수 문자열 필드 %s가 비어 있으면 거부한다", (field) => {
    expect(
      aiEmbeddingRowSchema.safeParse({
        ...validRow,
        [field]: "",
      }).success,
    ).toBe(false);
  });

  it.each([-1, 1.5])(
    "유효하지 않은 token_count 값 %s를 거부한다",
    (tokenCount) => {
      expect(
        aiEmbeddingRowSchema.safeParse({
          ...validRow,
          token_count: tokenCount,
        }).success,
      ).toBe(false);
    },
  );
});

describe("aiEmbeddingMatchRowSchema", () => {
  const validRow = {
    distance: 0.2,
    embedding_id: EMBEDDING_ID,
    similarity: 0.8,
    source_id: SOURCE_ID,
  };

  it("유효한 embedding match row를 허용한다", () => {
    expect(aiEmbeddingMatchRowSchema.parse(validRow)).toEqual(validRow);
  });

  it.each([
    ["embedding_id", "invalid-id"],
    ["source_id", "invalid-id"],
  ] as const)("유효하지 않은 UUID 필드 %s를 거부한다", (field, value) => {
    expect(
      aiEmbeddingMatchRowSchema.safeParse({
        ...validRow,
        [field]: value,
      }).success,
    ).toBe(false);
  });

  it.each([
    ["distance", "0.2"],
    ["similarity", "0.8"],
  ] as const)("숫자가 아닌 필드 %s를 거부한다", (field, value) => {
    expect(
      aiEmbeddingMatchRowSchema.safeParse({
        ...validRow,
        [field]: value,
      }).success,
    ).toBe(false);
  });
});
