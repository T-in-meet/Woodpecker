import { describe, expect, it } from "vitest";

import { OTP_LENGTH } from "@/features/auth/constants/otp";
import { verifyOtpActionSchema } from "@/features/auth/verify-otp/schemas/verifyOtpActionSchema";

describe("verifyOtpActionSchema", () => {
  const validInput = {
    email: "test@example.com",
    otp: "1".repeat(OTP_LENGTH),
    purpose: "signup",
    redirect: "/notes",
  };

  it("정상 입력이면 검증에 성공한다", () => {
    const result = verifyOtpActionSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it("redirect가 없어도 검증에 성공한다", () => {
    const { redirect: _redirect, ...inputWithoutRedirect } = validInput;

    const result = verifyOtpActionSchema.safeParse(inputWithoutRedirect);

    expect(result.success).toBe(true);
  });

  it("purpose가 허용되지 않은 값이면 검증에 실패한다", () => {
    const result = verifyOtpActionSchema.safeParse({
      ...validInput,
      purpose: "login",
    });

    expect(result.success).toBe(false);
  });

  it("정의되지 않은 필드가 포함되면 검증에 실패한다", () => {
    const result = verifyOtpActionSchema.safeParse({
      ...validInput,
      unexpected: "value",
    });

    expect(result.success).toBe(false);
  });
});
