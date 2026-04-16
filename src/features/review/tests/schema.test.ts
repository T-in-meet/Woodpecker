import { describe, expect, it } from "vitest";

import { completeReviewSchema, submitAnswerSchema } from "../schema";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_LOG_ID = "22222222-2222-4222-8222-222222222222";

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
      completionToken: "valid-token",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid ids", () => {
    const parsed = completeReviewSchema.safeParse({
      noteId: "note-123",
      reviewLogId: "log-123",
      completionToken: "",
    });

    expect(parsed.success).toBe(false);
  });
});
