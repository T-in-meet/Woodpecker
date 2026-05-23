import { describe, expect, it } from "vitest";

import { verifyOtpContextSchema } from "./verifyOtpContextSchema";

describe("verifyOtpContextSchema", () => {
  it("email과 purpose가 유효하면 통과한다", () => {
    const result = verifyOtpContextSchema.safeParse({
      email: "user@example.com",
      purpose: "signup",
    });

    expect(result.success).toBe(true);
  });

  it("redirect가 없어도 통과한다", () => {
    const result = verifyOtpContextSchema.safeParse({
      email: "user@example.com",
      purpose: "reset-password",
    });

    expect(result.success).toBe(true);
  });

  it("redirect가 있으면 함께 통과한다", () => {
    const result = verifyOtpContextSchema.safeParse({
      email: "user@example.com",
      purpose: "reset-password",
      redirect: "/reset-password",
    });

    expect(result.success).toBe(true);
  });

  it("email이 없으면 실패한다", () => {
    const result = verifyOtpContextSchema.safeParse({
      purpose: "signup",
    });

    expect(result.success).toBe(false);
  });

  it("purpose가 없으면 실패한다", () => {
    const result = verifyOtpContextSchema.safeParse({
      email: "user@example.com",
    });

    expect(result.success).toBe(false);
  });

  it("알 수 없는 필드가 있으면 실패한다", () => {
    const result = verifyOtpContextSchema.safeParse({
      email: "user@example.com",
      purpose: "signup",
      redirect: "/",
      otp: "123456",
    });

    expect(result.success).toBe(false);
  });
});
