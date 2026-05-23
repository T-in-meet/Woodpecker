import { z } from "zod";

import { otpSchema } from "@/lib/validation/otpSchema";

/**
 * verify-otp 페이지 OTP 입력 form schema.
 *
 * 역할:
 * - 사용자 OTP 입력값 검증
 * - react-hook-form client validation
 * - OTP 입력 UI 계약 정의
 *
 * 검증 대상:
 * - otp: 숫자 6자리 OTP 코드
 *
 * 주의:
 * - email, purpose, redirect 등의 값은 포함하지 않는다.
 * - 해당 값들은 서버 action에서 별도로 검증한다.
 */
export const verifyOtpFormSchema = z
  .object({
    otp: otpSchema,
  })
  .strict();

export type VerifyOtpFormValues = z.infer<typeof verifyOtpFormSchema>;
