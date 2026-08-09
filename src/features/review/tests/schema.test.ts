import { describe, expect, it } from "vitest";

import {
  completeReviewSchema,
  gradeAnswerSchema,
  gradingResponseSchema,
  submitAnswerSchema,
} from "../schema";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_LOG_ID = "22222222-2222-4222-8222-222222222222";
const NOTE_UPDATED_AT = "2026-07-04T00:00:00.000Z";

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
      originalUpdatedAt: NOTE_UPDATED_AT,
      answer: "기억나는 내용을 적었습니다.",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects blank answers", () => {
    const parsed = gradeAnswerSchema.safeParse({
      noteId: NOTE_ID,
      reviewLogId: REVIEW_LOG_ID,
      originalUpdatedAt: NOTE_UPDATED_AT,
      answer: "   ",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid ids", () => {
    const parsed = gradeAnswerSchema.safeParse({
      noteId: "note-123",
      reviewLogId: "log-123",
      originalUpdatedAt: NOTE_UPDATED_AT,
      answer: "답안",
    });

    expect(parsed.success).toBe(false);
  });

  // 원본 버전이 빠진 요청은 채점 기준을 확인할 수 없으므로 받지 않는다.
  it("rejects a payload without the original note version", () => {
    const parsed = gradeAnswerSchema.safeParse({
      noteId: NOTE_ID,
      reviewLogId: REVIEW_LOG_ID,
      answer: "답안",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("gradingResponseSchema", () => {
  it("accepts a valid Gemini grading response", () => {
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
});
