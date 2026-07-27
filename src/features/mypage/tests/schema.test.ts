import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  FEEDBACK_CONTENT_MAX_LENGTH,
  FEEDBACK_TITLE_MAX_LENGTH,
  feedbackSchema,
  profileSchema,
} from "../schema";

describe("profileSchema", () => {
  it("유효한 닉네임만으로 통과시킨다", () => {
    const result = profileSchema.safeParse({ nickname: "홍길동" });
    expect(result.success).toBe(true);
  });

  it("1자 닉네임을 허용한다", () => {
    const result = profileSchema.safeParse({ nickname: "a" });
    expect(result.success).toBe(true);
  });

  it("빈 문자열 닉네임을 거부한다", () => {
    const result = profileSchema.safeParse({ nickname: "" });
    expect(result.success).toBe(false);
  });

  it("10자 초과 닉네임을 거부한다", () => {
    const result = profileSchema.safeParse({ nickname: "a".repeat(11) });
    expect(result.success).toBe(false);
  });

  it("10자 닉네임을 통과시킨다", () => {
    const result = profileSchema.safeParse({ nickname: "a".repeat(10) });
    expect(result.success).toBe(true);
  });
});

describe("changePasswordSchema", () => {
  it("유효한 비밀번호 변경 데이터를 통과시킨다", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "password123",
      newPassword: "newpass123",
      confirmNewPassword: "newpass123",
    });
    expect(result.success).toBe(true);
  });

  it("8자 미만 현재 비밀번호를 거부한다", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "short",
      newPassword: "newpass123",
      confirmNewPassword: "newpass123",
    });
    expect(result.success).toBe(false);
  });

  it("8자 미만 새 비밀번호를 거부한다", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "password123",
      newPassword: "short",
      confirmNewPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("새 비밀번호 불일치를 거부한다", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "password123",
      newPassword: "newpass123",
      confirmNewPassword: "different123",
    });
    expect(result.success).toBe(false);
  });
});

describe("feedbackSchema", () => {
  const validInput = {
    category: "BUG",
    title: "버그 신고합니다",
    content: "복습 완료 버튼이 동작하지 않아요",
  };

  it("유효한 입력을 통과시킨다", () => {
    const result = feedbackSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("허용되지 않은 카테고리를 거부한다", () => {
    const result = feedbackSchema.safeParse({
      ...validInput,
      category: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("제목과 내용의 앞뒤 공백을 제거한다", () => {
    const result = feedbackSchema.safeParse({
      ...validInput,
      title: "  제목  ",
      content: "  내용  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("제목");
      expect(result.data.content).toBe("내용");
    }
  });

  it("공백뿐인 제목을 거부한다", () => {
    const result = feedbackSchema.safeParse({ ...validInput, title: "   " });
    expect(result.success).toBe(false);
  });

  it("최대 길이 제목을 통과시키고 초과를 거부한다", () => {
    expect(
      feedbackSchema.safeParse({
        ...validInput,
        title: "a".repeat(FEEDBACK_TITLE_MAX_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      feedbackSchema.safeParse({
        ...validInput,
        title: "a".repeat(FEEDBACK_TITLE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("최대 길이 내용을 통과시키고 초과를 거부한다", () => {
    expect(
      feedbackSchema.safeParse({
        ...validInput,
        content: "a".repeat(FEEDBACK_CONTENT_MAX_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      feedbackSchema.safeParse({
        ...validInput,
        content: "a".repeat(FEEDBACK_CONTENT_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("공백뿐인 내용을 거부한다", () => {
    const result = feedbackSchema.safeParse({ ...validInput, content: "   " });
    expect(result.success).toBe(false);
  });
});
