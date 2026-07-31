import { describe, expect, it } from "vitest";

import { OTP_LENGTH } from "@/features/auth/constants/otp";
import { VALIDATION_MESSAGES } from "@/lib/validation/messages";
import { otpSchema } from "@/lib/validation/otpSchema";

describe("otpSchema", () => {
  it("OTP_LENGTH 길이의 숫자 문자열이면 검증에 성공한다", () => {
    const validOtp = "1".repeat(OTP_LENGTH);

    const result = otpSchema.safeParse(validOtp);

    expect(result.success).toBe(true);
  });

  it("OTP_LENGTH보다 짧으면 검증에 실패한다", () => {
    const shortOtp = "1".repeat(OTP_LENGTH - 1);

    const result = otpSchema.safeParse(shortOtp);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        VALIDATION_MESSAGES.otpLength,
      );
    }
  });

  it("OTP_LENGTH보다 길면 검증에 실패한다", () => {
    const longOtp = "1".repeat(OTP_LENGTH + 1);

    const result = otpSchema.safeParse(longOtp);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        VALIDATION_MESSAGES.otpLength,
      );
    }
  });

  it("숫자가 아닌 문자가 포함되면 검증에 실패한다", () => {
    const invalidOtp = `${"1".repeat(OTP_LENGTH - 1)}a`;

    const result = otpSchema.safeParse(invalidOtp);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        VALIDATION_MESSAGES.otpInvalid,
      );
    }
  });
});
