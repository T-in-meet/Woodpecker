import { NextRequest } from "next/server";
import { z } from "zod";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { checkRequestEligibility } from "@/features/auth/lib/checkRequestEligibility";
import { failureResponse, successResponse } from "@/features/auth/lib/response";
import { resendVerificationEmail } from "@/features/auth/resend-verification-email/lib/resendVerificationEmail";
import { getClientIp } from "@/lib/utils/getClientIp";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

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
 * 1. IP 추출 (request eligibility check용)
 * 2. JSON 파싱 (malformed JSON 방어)
 * 3. Zod validation (형식 검증)
 * 4. 이메일 정규화 (lowercase)
 * 5. Request eligibility check (unified: IP + email short + email long)
 * 6. 메일 재전송
 * 7. 성공 응답 반환
 *
 * 설계 변경:
 * - cooldown timestamp 모델 제거 (email short window로 대체)
 * - 단일 entry point: checkRequestEligibility로 모든 rate limit 정책 처리
 * - atomic: 판단과 상태 업데이트가 함수 내에서 함께 일어남
 */
export async function POST(request: NextRequest) {
  /**
   * 1. IP 추출
   *
   * - request eligibility check를 위해 필요
   * - user-scoped 정책 (IP + email)에 기여
   */
  const ip = getClientIp(request);

  let body: unknown;

  /**
   * 2. JSON 파싱
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
   * 3. Zod validation
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
   * 4. 이메일 정규화
   *
   * - 대소문자 구분 제거
   * - request eligibility key 일관성 유지
   */
  const normalizedEmail = parsed.data.email.toLowerCase();

  /**
   * 5. Request eligibility check — unified decision
   *
   * 설계:
   * - single entry point: checkRequestEligibility(route, ip, email)
   * - atomic: 판단과 상태 업데이트가 함수 내에서 함께 일어남
   * - AND evaluation: IP, email short, email long 모두 통과해야 허용
   * - cooldown timestamp 제거: email short window로 대체 (즉시 재시도 억제)
   * - Observability: 차단 시에만 내부 로그 기록
   */
  const eligibility = checkRequestEligibility("resend", ip, normalizedEmail);
  if (!eligibility.allowed) {
    return failureResponse(AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED);
  }

  /**
   * 6. 인증 메일 재전송
   */
  await resendVerificationEmail(normalizedEmail);

  /**
   * 7. 성공 응답 반환
   */
  return successResponse(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS, {
    email: normalizedEmail,
    resent: true,
  });
}
