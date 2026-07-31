import { describe, expect, it } from "vitest";

import { feedbackReplyFormSchema } from "../schema";

describe("feedbackReplyFormSchema", () => {
  it("정상 입력을 통과한다", () => {
    const result = feedbackReplyFormSchema.safeParse({
      title: "관리자 답변",
      content: "답변 내용입니다.",
    });

    expect(result.success).toBe(true);
  });

  it("앞뒤 공백을 제거한 값을 반환한다", () => {
    const result = feedbackReplyFormSchema.parse({
      title: "  관리자 답변  ",
      content: "  답변 내용  ",
    });

    expect(result).toEqual({
      title: "관리자 답변",
      content: "답변 내용",
    });
  });

  it("제목이 비어 있으면 실패한다", () => {
    const result = feedbackReplyFormSchema.safeParse({
      title: "",
      content: "답변 내용",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.title).toEqual([
        "답변 제목을 입력해 주세요.",
      ]);
    }
  });

  it("공백만 있는 제목은 실패한다", () => {
    const result = feedbackReplyFormSchema.safeParse({
      title: "     ",
      content: "답변 내용",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.title).toEqual([
        "답변 제목을 입력해 주세요.",
      ]);
    }
  });

  it("제목이 100자를 초과하면 실패한다", () => {
    const result = feedbackReplyFormSchema.safeParse({
      title: "a".repeat(101),
      content: "답변 내용",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.title).toEqual([
        "답변 제목은 100자 이하로 입력해 주세요.",
      ]);
    }
  });

  it("내용이 비어 있으면 실패한다", () => {
    const result = feedbackReplyFormSchema.safeParse({
      title: "관리자 답변",
      content: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.content).toEqual([
        "답변 내용을 입력해 주세요.",
      ]);
    }
  });

  it("공백만 있는 내용은 실패한다", () => {
    const result = feedbackReplyFormSchema.safeParse({
      title: "관리자 답변",
      content: "     ",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.content).toEqual([
        "답변 내용을 입력해 주세요.",
      ]);
    }
  });
});
