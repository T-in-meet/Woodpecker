import { describe, expect, it } from "vitest";

import { changePasswordSchema, profileSchema } from "../schema";

describe("profileSchema", () => {
  it("유효한 닉네임만으로 통과시킨다", () => {
    const result = profileSchema.safeParse({ nickname: "홍길동" });
    expect(result.success).toBe(true);
  });

  it("유효한 닉네임과 avatarUrl로 통과시킨다", () => {
    const result = profileSchema.safeParse({
      nickname: "홍길동",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
  });

  it("avatarUrl 빈 문자열을 허용한다", () => {
    const result = profileSchema.safeParse({
      nickname: "홍길동",
      avatarUrl: "",
    });
    expect(result.success).toBe(true);
  });

  it("2자 미만 닉네임을 거부한다", () => {
    const result = profileSchema.safeParse({ nickname: "a" });
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

  it("잘못된 avatarUrl을 거부한다", () => {
    const result = profileSchema.safeParse({
      nickname: "홍길동",
      avatarUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
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
