import { describe, expect, it } from "vitest";

import { otpPurposeSchema } from "./otpPurposeSchema";

describe("otpPurposeSchema", () => {
  it("회원가입 OTP 목적을 허용한다", () => {
    const result = otpPurposeSchema.safeParse("signup");

    expect(result.success).toBe(true);
  });

  it("비밀번호 재설정 OTP 목적을 허용한다", () => {
    const result = otpPurposeSchema.safeParse("reset-password");

    expect(result.success).toBe(true);
  });

  it("허용되지 않은 OTP 목적이면 실패한다", () => {
    const result = otpPurposeSchema.safeParse("login");

    expect(result.success).toBe(false);
  });

  it("Supabase OTP 타입을 직접 목적값으로 사용하면 실패한다", () => {
    expect(otpPurposeSchema.safeParse("magiclink").success).toBe(false);
    expect(otpPurposeSchema.safeParse("recovery").success).toBe(false);
  });

  it("빈 문자열이면 실패한다", () => {
    const result = otpPurposeSchema.safeParse("");

    expect(result.success).toBe(false);
  });

  it("문자열이 아니면 실패한다", () => {
    const result = otpPurposeSchema.safeParse(null);

    expect(result.success).toBe(false);
  });
});
