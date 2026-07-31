import { z } from "zod";

import { OTP_LENGTH } from "@/features/auth/constants/otp";

import { VALIDATION_MESSAGES } from "./messages";

/**
 * OTP 코드 validation schema.
 *
 * 검증 규칙:
 * - OTP_LENGTH 길이와 일치해야 한다.
 * - 숫자만 허용한다.
 *
 * 사용 목적:
 * - OTP 입력 form validation
 * - verifyOtp server action validation
 * - OTP 관련 공통 입력 검증
 *
 * 주의:
 * - 실제 OTP 생성 및 검증은 Supabase가 수행한다.
 * - 해당 schema는 서비스 내부 입력 형식 검증만 담당한다.
 */
export const otpSchema = z
  .string()
  .length(OTP_LENGTH, VALIDATION_MESSAGES.otpLength)
  .regex(/^\d+$/, VALIDATION_MESSAGES.otpInvalid);
