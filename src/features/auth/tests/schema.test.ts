import { describe, expect, it } from "vitest";

import { loginSchema, signupSchema } from "../schema";

describe("loginSchema", () => {
  it("유효한 이메일과 비밀번호를 통과시킨다", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("잘못된 이메일을 거부한다", () => {
    const result = loginSchema.safeParse({
      email: "invalid-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("8자 미만 비밀번호를 거부한다", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("비밀번호가 일치하지 않으면 거부한다", () => {
    const result = signupSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      confirmPassword: "different",
    });
    expect(result.success).toBe(false);
  });
});
