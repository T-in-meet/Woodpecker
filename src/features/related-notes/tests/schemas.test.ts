import { describe, expect, it } from "vitest";

import {
  addManualRelatedNotesSchema,
  aiRelatedNoteMetadataSchema,
  manualRelatedNoteMetadataSchema,
  MAX_MANUAL_RELATED_NOTES_PER_REQUEST,
  relatedNoteMetadataSchema,
  relatedNoteRowSchema,
  requestRelatedNoteRecommendationSchema,
} from "../schemas";

describe("relatedNoteMetadataSchema", () => {
  it("Json-compatible 확장 필드를 허용한다", () => {
    const result = relatedNoteMetadataSchema.safeParse({
      reason: "비슷한 내용을 다룹니다.",
      rank: 1,
      nested: {
        score: 0.9,
      },
    });

    expect(result.success).toBe(true);
  });

  it("title이 없어도 허용한다", () => {
    expect(
      relatedNoteMetadataSchema.safeParse({
        reason: "제목 없음",
      }).success,
    ).toBe(true);

    expect(
      relatedNoteMetadataSchema.safeParse({
        title: "   ",
      }).success,
    ).toBe(true);
  });
});

describe("manualRelatedNoteMetadataSchema", () => {
  it("reason이 없어도 허용한다", () => {
    expect(manualRelatedNoteMetadataSchema.safeParse({}).success).toBe(true);
  });

  it("reason이 있으면 문자열 길이 제한을 검증한다", () => {
    expect(
      manualRelatedNoteMetadataSchema.safeParse({
        reason: "직접 연결한 이유입니다.",
      }).success,
    ).toBe(true);

    expect(
      manualRelatedNoteMetadataSchema.safeParse({
        reason: "a".repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe("aiRelatedNoteMetadataSchema", () => {
  it("reason이 있으면 허용한다", () => {
    expect(
      aiRelatedNoteMetadataSchema.safeParse({
        reason: "유사한 주제를 다루고 있습니다.",
      }).success,
    ).toBe(true);
  });

  it("reason이 없거나 비어 있으면 거부한다", () => {
    expect(aiRelatedNoteMetadataSchema.safeParse({}).success).toBe(false);

    expect(
      aiRelatedNoteMetadataSchema.safeParse({
        reason: "   ",
      }).success,
    ).toBe(false);
  });
});

describe("relatedNoteRowSchema", () => {
  it("manual origin은 reason이 없는 metadata도 허용한다", () => {
    expect(
      relatedNoteRowSchema.safeParse({
        note_id: "22222222-2222-4222-8222-222222222222",
        related_note_id: "11111111-1111-4111-8111-111111111111",
        origin: "manual",
        source_note: {
          title: "기준 노트",
        },
        related_note: {
          title: "수동 관련 노트",
        },
        metadata: {},
      }).success,
    ).toBe(true);
  });

  it("ai origin은 reason이 포함된 metadata만 허용한다", () => {
    expect(
      relatedNoteRowSchema.safeParse({
        note_id: "22222222-2222-4222-8222-222222222222",
        related_note_id: "11111111-1111-4111-8111-111111111111",
        origin: "ai",
        source_note: {
          title: "기준 노트",
        },
        related_note: {
          title: "AI 관련 노트",
        },
        metadata: {
          reason: "관련성이 높은 노트입니다.",
        },
      }).success,
    ).toBe(true);

    expect(
      relatedNoteRowSchema.safeParse({
        note_id: "22222222-2222-4222-8222-222222222222",
        related_note_id: "11111111-1111-4111-8111-111111111111",
        origin: "ai",
        source_note: {
          title: "기준 노트",
        },
        related_note: {
          title: "AI 관련 노트",
        },
        metadata: {},
      }).success,
    ).toBe(false);
  });

  it("지원하지 않는 origin은 거부한다", () => {
    expect(
      relatedNoteRowSchema.safeParse({
        note_id: "22222222-2222-4222-8222-222222222222",
        related_note_id: "11111111-1111-4111-8111-111111111111",
        origin: "invalid",
        source_note: {
          title: "기준 노트",
        },
        related_note: {
          title: "관련 노트",
        },
        metadata: {},
      }).success,
    ).toBe(false);
  });
});

describe("addManualRelatedNotesSchema", () => {
  it("한 번에 추가할 Related Notes 개수를 제한한다", () => {
    const relatedNotes = Array.from(
      { length: MAX_MANUAL_RELATED_NOTES_PER_REQUEST + 1 },
      (_, index) => ({
        relatedNoteId: `11111111-1111-4111-8111-${String(index).padStart(
          12,
          "0",
        )}`,
      }),
    );

    const result = addManualRelatedNotesSchema.safeParse({
      noteId: "22222222-2222-4222-8222-222222222222",
      relatedNotes,
    });

    expect(result.success).toBe(false);
  });
});

describe("requestRelatedNoteRecommendationSchema", () => {
  it("유효한 Note ID를 허용한다", () => {
    const result = requestRelatedNoteRecommendationSchema.safeParse({
      noteId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result.success).toBe(true);
  });

  it("유효하지 않은 Note ID를 거부한다", () => {
    const result = requestRelatedNoteRecommendationSchema.safeParse({
      noteId: "invalid-note-id",
    });

    expect(result.success).toBe(false);
  });

  it("Note ID가 없으면 거부한다", () => {
    const result = requestRelatedNoteRecommendationSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
