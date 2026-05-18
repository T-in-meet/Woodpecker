import { z } from "zod";

import { normalizedEmailSchema } from "@/lib/validation/emailSchema";
import { otpPurposeSchema } from "@/lib/validation/otpPurposeSchema";
import { otpSchema } from "@/lib/validation/otpSchema";

/**
 * verifyOtp server action 입력 validation schema.
 *
 * 검증 대상:
 * - email:
 *   → OTP 인증 대상 이메일
 *   → normalize된 이메일 형식을 사용한다.
 *
 * - otp:
 *   → 사용자가 입력한 OTP 코드
 *
 * - purpose:
 *   → OTP 인증 목적
 *   → signup | reset-password
 *
 * - redirect:
 *   → 인증 완료 이후 이동 경로
 *   → 선택 입력값(optional)
 *
 * 사용 목적:
 * - verifyOtp server action 입력 검증
 * - FormData 기반 서버 요청 계약 정의
 * - OTP 인증 흐름 분기 검증
 *
 * 주의:
 * - 클라이언트 form validation과는 별개로
 *   서버에서 반드시 다시 검증한다.
 *
 * - strict mode를 사용하여
 *   정의되지 않은 필드 유입을 차단한다.
 */
export const verifyOtpActionSchema = z
  .object({
    email: normalizedEmailSchema,
    otp: otpSchema,
    purpose: otpPurposeSchema,
    redirect: z.string().optional(),
  })
  .strict();

/**
 * verifyOtp server action 입력 타입.
 *
 * verifyOtpActionSchema를 기반으로 추론된다.
 */
export type VerifyOtpActionInput = z.infer<typeof verifyOtpActionSchema>;
