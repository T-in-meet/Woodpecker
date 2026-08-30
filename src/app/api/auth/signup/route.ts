import { NextRequest } from "next/server";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { issueOtpAndSendEmail } from "@/features/auth/email/issueOtpAndSendEmail";
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
  mapBlockedByToReason,
} from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { mapAuthValidationErrors } from "@/features/auth/lib/mapAuthValidationErrors";
import { maskEmailForLogging } from "@/features/auth/lib/maskEmailForLogging";
import { maskIpForLogging } from "@/features/auth/lib/maskIpForLogging";
import {
  AuthJsonParseError,
  parseAuthJsonRequestBody,
} from "@/features/auth/lib/parseAuthJsonRequestBody";
import { ensureUserAgreement } from "@/features/auth/lib/userAgreements";
import { signupApiSchema } from "@/features/auth/signup/schema/signupApiSchema";
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";
import { failureResponse, successResponse } from "@/lib/api/response";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/utils/getClientIp";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

/**
 * 회원가입 핵심 로직
 *
 * POST 핸들러에서 분리된 내부 함수.
 * 타이밍 정책(최소 응답 시간)은 POST에서 일괄 적용한다.
 */
type SignupTerminalOutcome =
  | {
      type: "invalid_input";
      reasonCode:
        | typeof AUTH_LOG_REASONS.INVALID_JSON
        | typeof AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED;
      maskedEmail?: string;
    }
  | {
      type: "blocked";
      reasonCode: // [이유: RATE_LIMIT_IP → RATE_LIMIT_IP_SHORT | RATE_LIMIT_IP_LONG으로 분리됨]
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG;
      maskedEmail?: string;
      maskedIp?: string;
    }
  | { type: "completed" };

type ResolveSignupResult = {
  response: Response;
  outcome: SignupTerminalOutcome;
};

async function resolveSignupResponse(
  request: NextRequest,
): Promise<ResolveSignupResult> {
  const makeSignupSuccess = (email: string) =>
    successResponse(AUTH_API_CODES.SIGNUP_SUCCESS, {
      email,
      redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent(email)}`,
    });

  /**
   * 요청 IP 추출 (rate limit key)
   */
  const ip = getClientIp(request);
  const maskedIp = maskIpForLogging(ip);

  /**
   * IP 사전 검증 — 본문 파싱 비용 없이 IP 차단
   *
   * [이유: spec precheck_ip_rate_limit — must_run_before_body_parsing 요건]
   * - 읽기 전용: ipStore를 읽기만 함, 상태 변경 금지
   * - 최종 결정 권한이 아님: 이후 checkRequestEligibility가 최종 판단
   */
  const precheck = checkIpRateLimitPrecheck(ip);
  if (!precheck.allowed) {
    const reasonCode =
      precheck.blockedBy === "ipLong"
        ? AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG
        : AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT;

    return {
      response: failureResponse(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED),
      outcome: {
        type: "blocked",
        reasonCode,
        maskedIp,
      },
    };
  }

  let body: unknown;
  try {
    body = await parseAuthJsonRequestBody(request);
  } catch (e) {
    /**
     * malformed JSON 처리
     */
    if (e instanceof AuthJsonParseError) {
      return {
        response: failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
          errors: [{ field: "body", reason: VALIDATION_REASON.INVALID_FORMAT }],
        }),
        outcome: {
          type: "invalid_input",
          reasonCode: AUTH_LOG_REASONS.INVALID_JSON,
        },
      };
    }
    throw e;
  }

  /**
   * 입력값 validation
   */
  const parsed = signupApiSchema.safeParse(body);

  if (!parsed.success) {
    return {
      response: failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
        errors: mapAuthValidationErrors(parsed.error, body),
      }),
      outcome: {
        type: "invalid_input",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      },
    };
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
    return {
      response: failureResponse(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED),
      outcome: {
        type: "blocked",
        reasonCode: mapBlockedByToReason(eligibility.blockedBy),
        maskedEmail,
        // [이유: blockedBy "ip" → "ipShort" | "ipLong"으로 분리됨]
        ...(eligibility.blockedBy === "ipShort" ||
        eligibility.blockedBy === "ipLong"
          ? { maskedIp }
          : {}),
      },
    };
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
   * OTP 이메일 재발송 시도 (side-effect)
   * ⚠️ 설계 의도:
   * - signup 정책은 OTP 입력 방식으로 이메일 인증을 처리한다.
   * - 기존 미인증 사용자는 새 계정을 만들지 않고 동일 이메일로 OTP를 재발급한다.
   */
  if (existingUser && existingUser.email_confirmed_at === null) {
    const deliveryEmail = existingUser?.email ?? email;

    try {
      await issueOtpAndSendEmail({
        purpose: "signup",
        email: deliveryEmail,
      });
    } catch {
      // 외부 응답 계약 통일: side-effect 실패는 여기서 로깅하지 않는다.
    }

    return {
      response: makeSignupSuccess(email),
      outcome: { type: "completed" },
    };
  }

  /**
   * [기존 사용자 - 인증 완료]
   *
   * 기존 가입 사용자에게도 동일한 성공 응답을 반환한다.
   * 계정 존재 여부 노출을 막기 위해 OTP 발송 실패 여부는 외부 응답에 반영하지 않는다.
   */
  if (existingUser && existingUser.email_confirmed_at !== null) {
    const deliveryEmail = existingUser?.email ?? email;

    try {
      await issueOtpAndSendEmail({
        purpose: "signup",
        email: deliveryEmail,
      });
    } catch {
      // 외부 응답 계약 통일: side-effect 실패는 여기서 로깅하지 않는다.
    }

    return {
      response: makeSignupSuccess(email),
      outcome: { type: "completed" },
    };
  }

  /**
   * [신규 사용자 가입]
   *
   * 순서:
   * 1) createUser로 auth user 생성 보장
   * 2) signup 목적의 OTP 발급
   * 3) 커스텀 OTP 이메일 발송
   *
   * 실패 정책:
   * - createUser 또는 OTP 발급/이메일 발송 실패는 내부 예외로 처리한다.
   * - POST 핸들러에서 SIGNUP_INTERNAL_ERROR로 정규화한다.
   */
  const adminClient = createAdminClient();

  /**
   * NOTE:
   * email_confirm: false는 이메일 인증 상태만 제어하며,
   * Supabase의 자동 이메일 발송을 비활성화하는 옵션이 아니다.
   * 검증 기준(2026-04-14): 현재 운영/스테이징 설정에서는 Supabase 기본 이메일이
   * 발송되지 않아 커스텀 OTP 메일만 발송되고 있다.
   *
   * ⚠️ 주의:
   * Supabase 이메일 설정(Auth Email Provider 포함)이 변경될 경우 기본 메일이 함께
   * 발송되어 중복 전송이 발생할 수 있으므로, 설정 전제를 유지해야 한다.
   * 설정 변경 시 signup 메일 발송 회귀 테스트를 반드시 수행한다.
   */
  const { data: createUserData, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email: email, // raw email — auth.users에 사용자 입력 보존
      password,
      email_confirm: false,
      user_metadata: { nickname, canonical_email: canonicalEmail }, // trigger가 profiles에 기록
    });

  if (createUserError) {
    throw createUserError;
  }

  if (createUserData.user?.id) {
    // 이메일 가입은 서버 validation을 통과한 약관 동의 사실을 user_id 기준으로 보존한다.
    await ensureUserAgreement(createUserData.user.id, "email");
  }

  await issueOtpAndSendEmail({ email, purpose: "signup" });

  /**
   * 최종 성공 응답
   *
   * 계정 존재 여부와 내부 분기 결과를 외부로 노출하지 않기 위해
   * 성공 가능한 경로는 동일한 SIGNUP_SUCCESS 응답 계약을 유지한다.
   */
  return { response: makeSignupSuccess(email), outcome: { type: "completed" } }; // raw email 응답
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
  logRequested(AUTH_EVENTS.AUTH_SIGNUP_REQUESTED, {
    path: request.nextUrl.pathname,
    method: request.method,
    provider: "email",
  });

  let resolved: ResolveSignupResult;
  try {
    resolved = await resolveSignupResponse(request);
  } catch (error) {
    const { errorMessage, errorName } = normalizeUnknownError(error);
    const response = failureResponse(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);

    // 현재는 내부 예외를 INTERNAL_ERROR로 정규화한다.
    // 상세 원인은 errorMessage/errorName으로 추적하며, reasonCode는 추후 세분화할 예정이다.
    logAuthError(AUTH_EVENTS.AUTH_SIGNUP_FAILED, {
      path: request.nextUrl.pathname,
      method: request.method,
      status: response.status,
      provider: "email",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      errorMessage,
      errorName,
    });

    return applyMinimumResponseTime(start, response);
  }

  const { response, outcome } = resolved;

  switch (outcome.type) {
    case "invalid_input":
      logAuthEvent(AUTH_EVENTS.AUTH_INVALID_INPUT, {
        path: request.nextUrl.pathname,
        method: request.method,
        status: response.status,
        provider: "email",
        result: "failure",
        reasonCode: outcome.reasonCode,
        ...(outcome.maskedEmail ? { maskedEmail: outcome.maskedEmail } : {}),
      });
      break;
    case "blocked":
      logAuthEvent(AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED, {
        path: request.nextUrl.pathname,
        method: request.method,
        status: response.status,
        provider: "email",
        result: "blocked",
        reasonCode: outcome.reasonCode,
        ...(outcome.maskedEmail ? { maskedEmail: outcome.maskedEmail } : {}),
        ...(outcome.maskedIp ? { maskedIp: outcome.maskedIp } : {}),
      });
      break;
    case "completed":
      logAuthEvent(AUTH_EVENTS.AUTH_SIGNUP_COMPLETED, {
        path: request.nextUrl.pathname,
        method: request.method,
        status: response.status,
        provider: "email",
        result: "success",
      });
      break;
  }

  return applyMinimumResponseTime(start, response);
}
