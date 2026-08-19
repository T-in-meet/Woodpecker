import { describe, expect, it } from "vitest";

import { relatedNoteMetadataSchema, relatedNoteRowSchema } from "../schemas";

describe("relatedNoteMetadataSchema", () => {
  it("제목과 Json-compatible 확장 필드를 허용한다", () => {
    const result = relatedNoteMetadataSchema.safeParse({
      title: "관련 노트",
      reason: "비슷한 내용을 다룹니다.",
      rank: 1,
      nested: {
        score: 0.9,
      },
    });

    expect(result.success).toBe(true);
  });

  it("제목이 없거나 비어 있으면 거부한다", () => {
    expect(
      relatedNoteMetadataSchema.safeParse({
        reason: "제목 없음",
      }).success,
    ).toBe(false);

    expect(
      relatedNoteMetadataSchema.safeParse({
        title: "   ",
      }).success,
    ).toBe(false);
  });
});

describe("relatedNoteRowSchema", () => {
  it("유효한 Related Notes row만 허용한다", () => {
    expect(
      relatedNoteRowSchema.safeParse({
        related_note_id: "11111111-1111-4111-8111-111111111111",
        origin: "ai",
        metadata: {
          title: "관련 노트",
        },
      }).success,
    ).toBe(true);

    expect(
      relatedNoteRowSchema.safeParse({
        related_note_id: "11111111-1111-4111-8111-111111111111",
        origin: "invalid",
        metadata: {
          title: "관련 노트",
        },
      }).success,
    ).toBe(false);
  });
});
