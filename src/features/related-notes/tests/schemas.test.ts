import { describe, expect, it } from "vitest";

import {
  aiRelatedNoteMetadataSchema,
  manualRelatedNoteMetadataSchema,
  relatedNoteMetadataSchema,
  relatedNoteRowSchema,
} from "../schemas";

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

describe("manualRelatedNoteMetadataSchema", () => {
  it("reason이 없어도 허용한다", () => {
    expect(
      manualRelatedNoteMetadataSchema.safeParse({
        title: "수동 관련 노트",
      }).success,
    ).toBe(true);
  });

  it("reason이 있으면 문자열 길이 제한을 검증한다", () => {
    expect(
      manualRelatedNoteMetadataSchema.safeParse({
        title: "수동 관련 노트",
        reason: "직접 연결한 이유입니다.",
      }).success,
    ).toBe(true);

    expect(
      manualRelatedNoteMetadataSchema.safeParse({
        title: "수동 관련 노트",
        reason: "a".repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe("aiRelatedNoteMetadataSchema", () => {
  it("title과 reason이 모두 있으면 허용한다", () => {
    expect(
      aiRelatedNoteMetadataSchema.safeParse({
        title: "AI 관련 노트",
        reason: "유사한 주제를 다루고 있습니다.",
      }).success,
    ).toBe(true);
  });

  it("reason이 없거나 비어 있으면 거부한다", () => {
    expect(
      aiRelatedNoteMetadataSchema.safeParse({
        title: "AI 관련 노트",
      }).success,
    ).toBe(false);

    expect(
      aiRelatedNoteMetadataSchema.safeParse({
        title: "AI 관련 노트",
        reason: "   ",
      }).success,
    ).toBe(false);
  });
});

describe("relatedNoteRowSchema", () => {
  it("manual origin은 reason이 없는 metadata도 허용한다", () => {
    expect(
      relatedNoteRowSchema.safeParse({
        related_note_id: "11111111-1111-4111-8111-111111111111",
        origin: "manual",
        metadata: {
          title: "수동 관련 노트",
        },
      }).success,
    ).toBe(true);
  });

  it("ai origin은 reason이 포함된 metadata만 허용한다", () => {
    expect(
      relatedNoteRowSchema.safeParse({
        related_note_id: "11111111-1111-4111-8111-111111111111",
        origin: "ai",
        metadata: {
          title: "AI 관련 노트",
          reason: "관련성이 높은 노트입니다.",
        },
      }).success,
    ).toBe(true);

    expect(
      relatedNoteRowSchema.safeParse({
        related_note_id: "11111111-1111-4111-8111-111111111111",
        origin: "ai",
        metadata: {
          title: "AI 관련 노트",
        },
      }).success,
    ).toBe(false);
  });

  it("지원하지 않는 origin은 거부한다", () => {
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
