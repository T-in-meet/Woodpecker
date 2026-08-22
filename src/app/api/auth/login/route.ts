import { NextRequest } from "next/server";

import { getAgreementRequiredPath } from "@/features/auth/constants/agreementRequired";
import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
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
import { mapAuthValidationErrors } from "@/features/auth/lib/mapAuthValidationErrors";
import { maskEmailForLogging } from "@/features/auth/lib/maskEmailForLogging";
import { maskIpForLogging } from "@/features/auth/lib/maskIpForLogging";
import {
  AuthJsonParseError,
  parseAuthJsonRequestBody,
} from "@/features/auth/lib/parseAuthJsonRequestBody";
import { getLegalAcceptanceStatus } from "@/features/auth/lib/userAgreements";
import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { loginApiSchema } from "@/features/auth/login/schema/loginApiSchema";
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";
import { failureResponse, successResponse } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/utils/getClientIp";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

/**
 * 로그인 요청의 내부 결과 타입
 *
 * 각 결과 타입은 finally에서 기록할 terminal event 종류를 결정한다:
 * - invalid_input → AUTH_INVALID_INPUT
 * - blocked       → AUTH_RATE_LIMIT_BLOCKED
 * - completed     → AUTH_LOGIN_COMPLETED
 * - failed        → AUTH_LOGIN_FAILED (인증 실패 또는 내부 오류)
 *
 * spec 근거: login-spec.md §8.1 Result Mapping
 */
type LoginTerminalOutcome =
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
  | { type: "completed" }
  | {
      type: "failed";
      reasonCode:
        | typeof AUTH_LOG_REASONS.INVALID_CREDENTIALS
        | typeof AUTH_LOG_REASONS.INTERNAL_ERROR;
      maskedEmail?: string;
      errorMessage?: string;
      errorName?: string;
    };

type ResolveLoginResult = {
  response: Response;
  outcome: LoginTerminalOutcome;
};

/**
 * 로그인 핵심 로직 — POST 핸들러에서 분리된 내부 함수
 *
 * 역할:
 * - 입력 검증, rate limit, Supabase 인증을 순서대로 수행
 * - 각 분기에 맞는 응답과 outcome을 반환
 *
 * 타이밍 정책(applyMinimumResponseTime)은 POST 핸들러에서 일괄 적용한다
 *
 * @param request 요청 객체
 * @param validatedRedirect validateRedirectPath로 검증된 redirect 경로
 */
async function resolveLoginResponse(
  request: NextRequest,
  validatedRedirect: string,
): Promise<ResolveLoginResult> {
  const ip = getClientIp(request);
  const maskedIp = maskIpForLogging(ip);

  /**
   * IP 사전 검증 — 본문 파싱 비용 없이 IP 차단
   * 읽기 전용: 상태 변경 없이 현재 IP 상태만 확인한다
   */
  const precheck = checkIpRateLimitPrecheck(ip);
  if (!precheck.allowed) {
    const reasonCode =
      precheck.blockedBy === "ipLong"
        ? AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG
        : AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT;

    return {
      response: failureResponse(AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED),
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
    if (e instanceof AuthJsonParseError) {
      return {
        response: failureResponse(AUTH_API_CODES.LOGIN_INVALID_INPUT, {
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
   * 입력값 validation — strict schema로 email/password 형식과 extra field 검증
   */
  const parsed = loginApiSchema.safeParse(body);
  if (!parsed.success) {
    return {
      response: failureResponse(AUTH_API_CODES.LOGIN_INVALID_INPUT, {
        errors: mapAuthValidationErrors(parsed.error, body),
      }),
      outcome: {
        type: "invalid_input",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      },
    };
  }

  const { email, password } = parsed.data;

  // 이메일 정규화 — Gmail alias 등을 동일 identity로 취급하기 위해 canonicalize
  const canonicalEmail = canonicalizeEmail(email);
  const maskedEmail = maskEmailForLogging(canonicalEmail);

  /**
   * Request eligibility — IP + email short/long window 통합 판별
   * atomic하게 판단과 상태 업데이트가 함께 일어난다
   */
  const eligibility = checkRequestEligibility("login", ip, canonicalEmail);
  if (!eligibility.allowed) {
    return {
      response: failureResponse(AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED),
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
   * Supabase signInWithPassword 호출
   *
   * 실제 email로 인증을 시도한다:
   * - canonicalEmail은 rate limit / identity key / logging masking 기준으로만 사용한다
   * - Supabase Auth에는 실제 email이 저장되므로 signInWithPassword에는 사용자가 입력한 email을 그대로 전달한다
   * - 성공 시 세션 쿠키가 자동으로 설정됨 (SSR client 특성)
   * - error가 존재하면 어떤 인증 실패든 동일하게 LOGIN_INVALID_CREDENTIALS로 처리
   *   (계정 존재 여부/비밀번호 불일치/미인증 여부를 외부에 노출하지 않기 위함)
   *
   *
   */
  const supabase = await createClient();
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError) {
    return {
      response: failureResponse(AUTH_API_CODES.LOGIN_INVALID_CREDENTIALS),
      outcome: {
        type: "failed",
        reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
        maskedEmail,
      },
    };
  }

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error("Authenticated user id is missing.");
  }

  const agreementStatus = await getLegalAcceptanceStatus(userId);
  if (!agreementStatus.canAccessService) {
    return {
      response: successResponse(AUTH_API_CODES.LOGIN_SUCCESS, {
        redirectTo: getAgreementRequiredPath(validatedRedirect),
      }),
      outcome: { type: "completed" },
    };
  }

  return {
    response: successResponse(AUTH_API_CODES.LOGIN_SUCCESS, {
      redirectTo: validatedRedirect,
    }),
    outcome: { type: "completed" },
  };
}

/**
 * 로그인 API 핸들러
 *
 * JSON Body Auth Write Route Template 준수:
 * 1. AUTH_LOGIN_REQUESTED 기록
 * 2. startTime 기록
 * 3. redirect query 검증 (validateRedirectPath)
 * 4. try: resolveLoginResponse
 * 5. catch: LOGIN_INTERNAL_ERROR + AUTH_LOGIN_FAILED 기록
 * 6. switch(outcome.type): terminal event 기록
 * 7. applyMinimumResponseTime 적용 (timing attack 방어)
 *
 * spec 근거: auth-shared-spec.md §8.1 JSON Body Auth Write Route Template
 */
export async function POST(request: NextRequest) {
  const start = Date.now();

  logRequested(AUTH_EVENTS.AUTH_LOGIN_REQUESTED, {
    path: request.nextUrl.pathname,
    method: request.method,
    provider: "email",
  });

  /**
   * redirect query 검증 — 로그인 성공 후 이동할 경로를 미리 결정
   * 잘못된 값은 validateRedirectPath가 /mypage로 fallback 처리
   */
  const validatedRedirect = validateRedirectPath(
    request.nextUrl.searchParams.get("redirect"),
  );

  let resolved: ResolveLoginResult;

  try {
    resolved = await resolveLoginResponse(request, validatedRedirect);
  } catch (error) {
    const { errorMessage, errorName } = normalizeUnknownError(error);
    const response = failureResponse(AUTH_API_CODES.LOGIN_INTERNAL_ERROR);

    logAuthError(AUTH_EVENTS.AUTH_LOGIN_FAILED, {
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

  /**
   * terminal event 기록 — REQUESTED 이후 정확히 1회만 기록
   * spec 근거: auth-shared-spec.md §7.2 Single Resolution Rule
   */
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
      logAuthEvent(AUTH_EVENTS.AUTH_LOGIN_COMPLETED, {
        path: request.nextUrl.pathname,
        method: request.method,
        status: response.status,
        provider: "email",
        result: "success",
      });
      break;

    case "failed":
      // 인증 실패(INVALID_CREDENTIALS)와 내부 오류(INTERNAL_ERROR) 모두 AUTH_LOGIN_FAILED로 기록
      // 외부 응답 코드(401/500)와 내부 로그 이벤트는 분리되어야 한다
      logAuthError(AUTH_EVENTS.AUTH_LOGIN_FAILED, {
        path: request.nextUrl.pathname,
        method: request.method,
        status: response.status,
        provider: "email",
        result: "failure",
        reasonCode: outcome.reasonCode,
        ...(outcome.maskedEmail ? { maskedEmail: outcome.maskedEmail } : {}),
        ...(outcome.errorMessage
          ? {
              errorMessage: outcome.errorMessage,
              errorName: outcome.errorName ?? "UnknownError",
            }
          : {}),
      });
      break;
  }

  return applyMinimumResponseTime(start, response);
}
