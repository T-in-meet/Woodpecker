import { z } from "zod";

import { OTP_PURPOSES } from "@/features/auth/constants/otp";

/**
 * 서비스 내부 OTP 인증 목적 validation schema.
 *
 * 허용 목적:
 * - signup
 *   → 회원가입 이메일 인증 흐름
 *
 * - reset-password
 *   → 비밀번호 재설정 인증 흐름
 *
 * 사용 목적:
 * - server action 입력 검증
 * - OTP 인증 흐름 분기 검증
 * - 서비스 내부 OTP 목적값 validation
 *
 * 주의:
 * - Supabase OTP 타입(magiclink, recovery)과는 구분된다.
 * - 실제 Supabase 타입 변환은
 *   OTP_PURPOSE_TO_SUPABASE_TYPE에서 처리한다.
 */
export const otpPurposeSchema = z.enum(OTP_PURPOSES);

/**
 * 서비스 내부 OTP 인증 목적 타입.
 *
 * otpPurposeSchema를 기반으로 추론된다.
 */
export type OtpPurpose = z.infer<typeof otpPurposeSchema>;
