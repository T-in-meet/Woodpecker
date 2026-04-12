import { z } from "zod";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";

/**
 * 인증 메일 재전송 성공 응답 스키마
 *
 * 설계 의도:
 * - 서버 response contract를 클라이언트에서 검증한다.
 * - 예상하지 못한 응답 형태를 런타임에서 차단한다.
 */
export const resendSuccessResponseSchema = z.object({
  success: z.literal(true),
  code: z.literal(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS),
  data: z.object({
    email: z.string(),
    resent: z.boolean(),
  }),
});
