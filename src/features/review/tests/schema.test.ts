import { describe, expect, it } from "vitest";

import { toCloudflareResponseSchema } from "@/lib/ai/responseSchema";

import {
  completeReviewSchema,
  FEEDBACK_ITEMS_MAX,
  gradeAnswerSchema,
  gradingGenerationSchema,
  gradingResponseSchema,
  normalizeGradingResponse,
  submitAnswerSchema,
} from "../schema";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_LOG_ID = "22222222-2222-4222-8222-222222222222";
const CONTENT_HASH = "a".repeat(64);

describe("submitAnswerSchema", () => {
  it("accepts a valid answer payload", () => {
    const parsed = submitAnswerSchema.safeParse({
      noteId: NOTE_ID,
      answer: "기억나는 내용을 적었습니다.",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects blank answers", () => {
    const parsed = submitAnswerSchema.safeParse({
      noteId: NOTE_ID,
      answer: "   ",
    });

    expect(parsed.success).toBe(false);

    if (parsed.success) {
      throw new Error("blank answers must be rejected");
    }

    expect(parsed.error.flatten().fieldErrors.answer).toContain(
      "답안을 입력해주세요",
    );
  });
});

describe("completeReviewSchema", () => {
  it("accepts valid ids", () => {
    const parsed = completeReviewSchema.safeParse({
      noteId: NOTE_ID,
      reviewLogId: REVIEW_LOG_ID,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid ids", () => {
    const parsed = completeReviewSchema.safeParse({
      noteId: "note-123",
      reviewLogId: "log-123",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("gradeAnswerSchema", () => {
  it("accepts a valid grading request payload", () => {
    const parsed = gradeAnswerSchema.safeParse({
      noteId: NOTE_ID,
      reviewLogId: REVIEW_LOG_ID,
      originalContentHash: CONTENT_HASH,
      answer: "기억나는 내용을 적었습니다.",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects blank answers", () => {
    const parsed = gradeAnswerSchema.safeParse({
      noteId: NOTE_ID,
      reviewLogId: REVIEW_LOG_ID,
      originalContentHash: CONTENT_HASH,
      answer: "   ",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid ids", () => {
    const parsed = gradeAnswerSchema.safeParse({
      noteId: "note-123",
      reviewLogId: "log-123",
      originalContentHash: CONTENT_HASH,
      answer: "답안",
    });

    expect(parsed.success).toBe(false);
  });

  // 원본 해시가 빠진 요청은 채점 기준을 확인할 수 없으므로 받지 않는다.
  it("rejects a payload without the original content hash", () => {
    const parsed = gradeAnswerSchema.safeParse({
      noteId: NOTE_ID,
      reviewLogId: REVIEW_LOG_ID,
      answer: "답안",
    });

    expect(parsed.success).toBe(false);
  });

  // 해시가 아닌 값(예전 updated_at ISO 문자열 등)은 형식 단계에서 걸러낸다.
  it("rejects an original content hash that is not a sha256 hex digest", () => {
    const parsed = gradeAnswerSchema.safeParse({
      noteId: NOTE_ID,
      reviewLogId: REVIEW_LOG_ID,
      originalContentHash: "2026-07-04T00:00:00.000Z",
      answer: "답안",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("gradingResponseSchema", () => {
  it("accepts a valid AI grading response", () => {
    const parsed = gradingResponseSchema.safeParse({
      score: 85,
      summary: "핵심 개념을 대부분 회상했어요.",
      missedConcepts: ["개념 A"],
      incorrectPoints: [],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects out-of-range scores", () => {
    const parsed = gradingResponseSchema.safeParse({
      score: 120,
      summary: "총평",
      missedConcepts: [],
      incorrectPoints: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects non-integer scores", () => {
    const parsed = gradingResponseSchema.safeParse({
      score: 85.5,
      summary: "총평",
      missedConcepts: [],
      incorrectPoints: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects responses missing feedback fields", () => {
    const parsed = gradingResponseSchema.safeParse({
      score: 85,
      summary: "총평",
    });

    expect(parsed.success).toBe(false);
  });

  // 개수 초과로 채점 전체를 버리면 하루 한도 1회가 영구 소모되고 120초간 재시도가 막힌다.
  // 항목 하나 때문에 치를 값이 아니라 수신은 관대하게 두고 정규화로 맞춘다.
  it("accepts more feedback items than the limit", () => {
    const parsed = gradingResponseSchema.safeParse({
      score: 85,
      summary: "총평",
      missedConcepts: Array.from(
        { length: FEEDBACK_ITEMS_MAX + 1 },
        (_, index) => `개념 ${index}`,
      ),
      incorrectPoints: [],
    });

    expect(parsed.success).toBe(true);
  });

  it("still rejects non-string feedback items", () => {
    const parsed = gradingResponseSchema.safeParse({
      score: 85,
      summary: "총평",
      missedConcepts: ["개념 A", 42],
      incorrectPoints: [],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("gradingGenerationSchema", () => {
  it("rejects more feedback items than the limit", () => {
    const overLimit = Array.from(
      { length: FEEDBACK_ITEMS_MAX + 1 },
      (_, index) => `개념 ${index}`,
    );

    expect(
      gradingGenerationSchema.safeParse({
        score: 85,
        summary: "총평",
        missedConcepts: overLimit,
        incorrectPoints: [],
      }).success,
    ).toBe(false);
    expect(
      gradingGenerationSchema.safeParse({
        score: 85,
        summary: "총평",
        missedConcepts: [],
        incorrectPoints: overLimit,
      }).success,
    ).toBe(false);
  });

  // 이 스키마의 존재 이유는 구조화 출력 JSON Schema에 maxItems를 싣는 것이다.
  // 변환 과정에서 빠지면 생성 단계 강제가 사라지고 정규화만 남는다.
  it("carries maxItems into the AI response schema", () => {
    const jsonSchema = toCloudflareResponseSchema(gradingGenerationSchema);

    expect(jsonSchema).toMatchObject({
      properties: {
        missedConcepts: { maxItems: FEEDBACK_ITEMS_MAX },
        incorrectPoints: { maxItems: FEEDBACK_ITEMS_MAX },
      },
    });
  });
});

describe("normalizeGradingResponse", () => {
  it("truncates both feedback arrays to the limit", () => {
    const overLimit = Array.from(
      { length: FEEDBACK_ITEMS_MAX + 3 },
      (_, index) => `항목 ${index}`,
    );

    const normalized = normalizeGradingResponse({
      score: 85,
      summary: "총평",
      missedConcepts: overLimit,
      incorrectPoints: overLimit,
    });

    expect(normalized.missedConcepts).toEqual(
      overLimit.slice(0, FEEDBACK_ITEMS_MAX),
    );
    expect(normalized.incorrectPoints).toEqual(
      overLimit.slice(0, FEEDBACK_ITEMS_MAX),
    );
  });

  it("leaves responses within the limit untouched", () => {
    const response = {
      score: 85,
      summary: "총평",
      missedConcepts: ["개념 A"],
      incorrectPoints: [],
    };

    expect(normalizeGradingResponse(response)).toEqual(response);
  });
});
