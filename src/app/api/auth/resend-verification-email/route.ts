import { NextRequest } from "next/server";
import { z } from "zod";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { failureResponse, successResponse } from "@/features/auth/lib/response";
import { checkResendRateLimit } from "@/features/auth/resend-verification-email/lib/checkResendRateLimit";
import { getLastVerificationResendAt } from "@/features/auth/resend-verification-email/lib/getLastVerificationResendAt";
import { resendVerificationEmail } from "@/features/auth/resend-verification-email/lib/resendVerificationEmail";
import { setLastVerificationResendAt } from "@/features/auth/resend-verification-email/lib/setLastVerificationResendAt";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

/**
 * 인증 메일 재전송 최소 간격 (쿨다운)
 *
 * - 동일 이메일로 너무 자주 재전송되는 것을 방지
 * - UX 측면: 버튼 disable 시간과 동일하게 맞춰야 함
 */
const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * 재전송 요청 스키마
 *
 * - email: 문자열 → trim → 이메일 형식 검증
 * - boundary validation (외부 입력 검증) 역할
 */
const resendSchema = z.object({
  email: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.email()),
});

/**
 * 이메일 인증 재전송 API
 *
 * 흐름:
 * 1. JSON 파싱 (malformed JSON 방어)
 * 2. Zod validation (형식 검증)
 * 3. 이메일 정규화 (lowercase)
 * 4. cooldown 검사 (최근 재전송 시간 기준)
 * 5. rate limit 검사 (과도한 요청 방지)
 * 6. 메일 재전송
 * 7. 마지막 전송 시간 기록
 * 8. 성공 응답 반환
 */
export async function POST(request: NextRequest) {
  let body: unknown;

  /**
   * 1. JSON 파싱
   *
   * - Content-Type은 JSON이지만 body가 깨진 경우 방어
   * - validation 이전 단계이므로 field는 "body"로 처리
   */
  try {
    body = await request.json();
  } catch {
    return failureResponse(AUTH_API_CODES.RESEND_INVALID_INPUT, {
      errors: [{ field: "body", reason: VALIDATION_REASON.INVALID_FORMAT }],
    });
  }

  /**
   * 2. Zod validation
   *
   * - 이메일 형식 검증
   * - 실패 시 INVALID_INPUT 반환
   */
  const parsed = resendSchema.safeParse(body);

  if (!parsed.success) {
    return failureResponse(AUTH_API_CODES.RESEND_INVALID_INPUT, {
      status: 400,
    });
  }

  /**
   * 3. 이메일 정규화
   *
   * - 대소문자 구분 제거
   * - rate limit / cooldown key 일관성 유지
   */
  const normalizedEmail = parsed.data.email.toLowerCase();

  /**
   * 4. cooldown 검사
   *
   * - 마지막 전송 시점과 현재 시간 비교
   * - 일정 시간 내 재요청 시 conflict 반환
   */
  const lastResendAt = await getLastVerificationResendAt(normalizedEmail);
  const now = Date.now();

  if (lastResendAt !== null && now - lastResendAt < RESEND_COOLDOWN_MS) {
    return failureResponse(
      AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_COOLDOWN_CONFLICT,
    );
  }

  /**
   * 5. rate limit 검사
   *
   * - 일정 횟수 초과 시 요청 차단
   * - abuse / 공격 방지
   */
  const rateLimit = await checkResendRateLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    return failureResponse(AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED);
  }

  /**
   * 6. 인증 메일 재전송
   */
  await resendVerificationEmail(normalizedEmail);

  /**
   * 7. 마지막 전송 시간 기록
   *
   * - cooldown 계산 기준으로 사용
   */
  await setLastVerificationResendAt(normalizedEmail, now);

  /**
   * 8. 성공 응답 반환
   */
  return successResponse(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS, {
    email: normalizedEmail,
    resent: true,
  });
}
