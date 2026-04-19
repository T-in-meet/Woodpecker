import { NextRequest } from "next/server";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { issueAuthEmailLinkAndSend } from "@/features/auth/email/issueAuthEmailLinkAndSend";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { applyMinimumResponseTime } from "@/features/auth/lib/applyMinimumResponseTime";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
  normalizeUnknownError,
} from "@/features/auth/lib/authLogger";
import {
  checkIpRateLimitPrecheck,
  checkRequestEligibility,
} from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { mapAuthValidationErrors } from "@/features/auth/lib/mapAuthValidationErrors";
import { maskEmailForLogging } from "@/features/auth/lib/maskEmailForLogging";
import {
  AuthJsonParseError,
  parseAuthJsonRequestBody,
} from "@/features/auth/lib/parseAuthJsonRequestBody";
import { signupApiSchema } from "@/features/auth/signup/schema/signupApiSchema";
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";
import { failureResponse, successResponse } from "@/lib/api/response";
import { ROUTES } from "@/lib/constants/routes";
import { logError, logWarn } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/utils/getClientIp";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

/**
 * 회원가입 핵심 로직
 *
 * POST 핸들러에서 분리된 내부 함수.
 * 타이밍 정책(최소 응답 시간)은 POST에서 일괄 적용한다.
 */
async function resolveSignupResponse(request: NextRequest): Promise<Response> {
  const makeSignupSuccess = (email: string) =>
    successResponse(AUTH_API_CODES.SIGNUP_SUCCESS, {
      email,
      redirectTo: ROUTES.VERIFY_EMAIL,
    });

  /**
   * 요청 IP 추출 (rate limit key)
   */
  const ip = getClientIp(request);

  /**
   * IP 사전 검증 — 본문 파싱 비용 없이 IP 차단
   *
   * [이유: spec precheck_ip_rate_limit — must_run_before_body_parsing 요건]
   * - 읽기 전용: ipStore를 읽기만 함, 상태 변경 금지
   * - 최종 결정 권한이 아님: 이후 checkRequestEligibility가 최종 판단
   */
  const precheck = checkIpRateLimitPrecheck(ip);
  if (!precheck.allowed) {
    return failureResponse(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  }

  let body: unknown;
  try {
    body = await parseAuthJsonRequestBody(request);
  } catch (e) {
    /**
     * malformed JSON 처리
     */
    if (e instanceof AuthJsonParseError) {
      logAuthError(AUTH_EVENTS.AUTH_SIGNUP_FAILED, {
        path: request.nextUrl.pathname,
        method: request.method,
        status: 400,
        provider: "email",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.INVALID_JSON,
      });
      return failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
        errors: [{ field: "body", reason: VALIDATION_REASON.INVALID_FORMAT }],
      });
    }
    throw e;
  }

  /**
   * 입력값 validation
   */
  const parsed = signupApiSchema.safeParse(body);

  if (!parsed.success) {
    logAuthError(AUTH_EVENTS.AUTH_SIGNUP_FAILED, {
      path: request.nextUrl.pathname,
      method: request.method,
      status: 400,
      provider: "email",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
    });
    return failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
      errors: mapAuthValidationErrors(parsed.error, body),
    });
  }

  const { email, password, nickname } = parsed.data;

  const canonicalEmail = canonicalizeEmail(email);
  const maskedEmail = maskEmailForLogging(canonicalEmail);

  /**
   * Request eligibility check — IP, email short, email long 에 대한 통합 판별
   *
   * 설계:
   * - single entry point: checkRequestEligibility 하나로 모든 조건 평가
   * - atomic: 판단과 상태 업데이트가 함수 내에서 함께 일어남
   * - AND evaluation: 세 조건(IP, short, long) 모두 통과해야 허용
   * - 차단 시 blockedBy를 반환하며, 로깅은 route handler(여기)에서 담당한다
   */
  const eligibility = checkRequestEligibility("signup", ip, canonicalEmail);
  if (!eligibility.allowed) {
    logAuthEvent(AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED, {
      path: request.nextUrl.pathname,
      method: request.method,
      status: 429,
      provider: "email",
      result: "blocked",
      reasonCode:
        eligibility.blockedBy === "ip"
          ? AUTH_LOG_REASONS.RATE_LIMIT_IP
          : eligibility.blockedBy === "emailShort"
            ? AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT
            : AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG,
      maskedEmail,
    });
    return failureResponse(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  }

  /**
   * 기존 사용자 조회 (내부 분기용)
   *
   * ⚠️ 중요:
   * - 외부 응답은 반드시 동일해야 함
   */
  const existingUser = await getUserByEmail(canonicalEmail);

  /**
   * [기존 사용자 - 미인증]
   *
   * 이메일 재발송 시도 (side-effect)
   * ⚠️ 설계 의도:
   * - signup 정책은 magiclink 단일 타입을 사용한다.
   * - 링크 클릭 시 "이메일 인증"과 "로그인"을 한 번에 처리한다.
   */
  if (existingUser && existingUser.email_confirmed_at === null) {
    const deliveryEmail = existingUser?.email ?? email;
    try {
      await issueAuthEmailLinkAndSend({
        type: "magiclink", // 로그인 인증 링크 생성
        email: deliveryEmail,
      });
    } catch {
      logWarn({ event: "signup-email-resend-failed", maskedEmail });
    }

    return makeSignupSuccess(email);
  }

  /**
   * [기존 사용자 - 인증 완료]
   *
   * 미인증 사용자와 동일한 email link 흐름을 적용한다.
   * notify ticket 없이 magiclink로 통일한다.
   */
  if (existingUser && existingUser.email_confirmed_at !== null) {
    const deliveryEmail = existingUser?.email ?? email;
    try {
      await issueAuthEmailLinkAndSend({
        type: "magiclink",
        email: deliveryEmail,
      });
    } catch {
      logWarn({ event: "signup-email-send-failed", maskedEmail });
    }

    return makeSignupSuccess(email);
  }

  /**
   * [신규 사용자 가입]
   *
   * 순서:
   * 1) createUser로 auth user 생성 보장
   * 2) magiclink 발급
   * 3) 커스텀 메일 발송
   *
   * 실패 정책:
   * - createUser/generateLink/tokenHash/sendAuthEmail 실패는 모두 외부에 노출하지 않는다.
   * - 내부 로깅만 남기고 동일한 SIGNUP_SUCCESS 계약을 유지한다.
   */
  const adminClient = createAdminClient();

  /**
   * NOTE:
   * email_confirm: false는 이메일 인증 상태만 제어하며,
   * Supabase의 자동 이메일 발송을 비활성화하는 옵션이 아니다.
   * 검증 기준(2026-04-14): 현재 운영/스테이징 설정에서는 Supabase 기본 이메일이
   * 발송되지 않아 커스텀 magiclink 메일만 발송되고 있다.
   *
   * ⚠️ 주의:
   * Supabase 이메일 설정(Auth Email Provider 포함)이 변경될 경우 기본 메일이 함께
   * 발송되어 중복 전송이 발생할 수 있으므로, 설정 전제를 유지해야 한다.
   * 설정 변경 시 signup 메일 발송 회귀 테스트를 반드시 수행한다.
   */
  const { error: createUserError } = await adminClient.auth.admin.createUser({
    email: email, // raw email — auth.users에 사용자 입력 보존
    password,
    email_confirm: false,
    user_metadata: { nickname, canonical_email: canonicalEmail }, // trigger가 profiles에 기록
  });

  if (createUserError) {
    logError({
      event: "signup-create-user-failed",
      maskedEmail,
      errorMessage: createUserError.message,
      errorName: createUserError.name,
      errorCode: createUserError.code ?? undefined,
    });
    return makeSignupSuccess(email); // raw email 응답
  }

  const { data, error } = await adminClient.auth.admin.generateLink({
    email: email, // raw email — auth.users의 실제 email
    type: "magiclink",
    options: {
      data: { nickname },
    },
  });

  if (error) {
    logError({
      event: "signup-generate-link-failed",
      maskedEmail,
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.code ?? undefined,
    });

    return makeSignupSuccess(email); // raw email 응답
  }

  const tokenHash = data.properties?.hashed_token;

  if (!tokenHash) {
    logError({ event: "signup-no-token-hash", maskedEmail });
    return makeSignupSuccess(email); // raw email 응답
  }

  try {
    await sendAuthEmail(email, tokenHash, "magiclink"); // raw email 발송
  } catch (sendError) {
    const { errorMessage, errorName } = normalizeUnknownError(sendError);
    logError({
      event: "signup-send-email-failed",
      maskedEmail,
      errorMessage,
      errorName,
    });
    // AE 방어: 이메일 발송 실패를 외부에 노출하지 않는다.
    // 계정은 이미 생성됨. 사용자는 재가입 시도 또는 /resend-verification-email로 재발송 가능.
  }

  /**
   * 최종 성공 응답 (완전 통일)
   */
  return makeSignupSuccess(email); // raw email 응답
}

/**
 * 회원가입 API (Account Enumeration 방어 적용)
 *
 * 핵심 원칙:
 * - 외부 응답은 항상 동일하게 유지
 * - 내부 상태 분기는 유지하되 외부로 노출하지 않음
 * - 응답만 보고 계정 존재 여부를 추론할 수 없도록 설계
 * - 모든 경로(성공/실패/예외)는 최소 응답 시간을 보장한다
 */
export async function POST(request: NextRequest) {
  const start = Date.now();
  let response: Response;
  let wasException = false;

  logRequested(AUTH_EVENTS.AUTH_SIGNUP_REQUESTED, {
    path: request.nextUrl.pathname,
    method: request.method,
    provider: "email",
  });

  try {
    response = await resolveSignupResponse(request);
  } catch {
    wasException = true;
    response = failureResponse(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
  }

  if (response.status === 200) {
    logAuthEvent(AUTH_EVENTS.AUTH_SIGNUP_COMPLETED, {
      path: request.nextUrl.pathname,
      method: request.method,
      status: response.status,
      provider: "email",
      result: "success",
    });
  } else if (wasException) {
    logAuthError(AUTH_EVENTS.AUTH_SIGNUP_FAILED, {
      path: request.nextUrl.pathname,
      method: request.method,
      status: response.status,
      provider: "email",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
    });
  }

  return applyMinimumResponseTime(start, response);
}
