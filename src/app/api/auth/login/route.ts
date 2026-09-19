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
  classifyAuthProviderError,
  isPasswordLoginCredentialFailure,
  isPasswordLoginNonCredentialAuthFailure,
} from "@/features/auth/lib/classifyAuthProviderError";
import { mapAuthValidationErrors } from "@/features/auth/lib/mapAuthValidationErrors";
import { maskEmailForLogging } from "@/features/auth/lib/maskEmailForLogging";
import { maskIpForLogging } from "@/features/auth/lib/maskIpForLogging";
import {
  AuthJsonParseError,
  parseAuthJsonRequestBody,
} from "@/features/auth/lib/parseAuthJsonRequestBody";
import { authGlobalRequestRateLimit } from "@/features/auth/lib/rate-limit/authGlobalRequestRateLimit";
import { getTrustedAuthClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";
import { getLegalAcceptanceStatus } from "@/features/auth/lib/userAgreements";
import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import {
  loginRateLimit,
  type LoginRateLimitBlockedBy,
} from "@/features/auth/login/lib/loginRateLimit";
import { loginApiSchema } from "@/features/auth/login/schema/loginApiSchema";
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";
import { failureResponse, successResponse } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

/**
 * Password Login local Rate Limit 차단 원인을 내부 로그 reason으로 변환한다.
 *
 * IP short/long은 외부 정책 의미가 동일하므로 하나의 Login IP reason으로 기록한다.
 *
 * @param blockedBy Login Rate Limit service 차단 원인
 * @returns 구조화 로그 reason
 */
function mapLoginBlockedByToReason(
  blockedBy: LoginRateLimitBlockedBy,
):
  | typeof AUTH_LOG_REASONS.LOGIN_EMAIL_LIMIT
  | typeof AUTH_LOG_REASONS.LOGIN_IP_LIMIT
  | typeof AUTH_LOG_REASONS.LOGIN_FAILURE_STREAK {
  switch (blockedBy) {
    case "email_attempt":
      return AUTH_LOG_REASONS.LOGIN_EMAIL_LIMIT;

    case "ip_short":
    case "ip_long":
      return AUTH_LOG_REASONS.LOGIN_IP_LIMIT;

    case "failure_streak":
      return AUTH_LOG_REASONS.LOGIN_FAILURE_STREAK;
  }
}

/**
 * 로그인 요청의 내부 결과 타입.
 *
 * 외부 public code와 내부 structured log reason을 분리하여
 * Local Rate Limit과 Provider Rate Limit 등 서로 다른 내부 원인을 구분한다.
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
      reasonCode:
        | typeof AUTH_LOG_REASONS.AUTH_GLOBAL_IP_LIMIT
        | typeof AUTH_LOG_REASONS.LOGIN_EMAIL_LIMIT
        | typeof AUTH_LOG_REASONS.LOGIN_IP_LIMIT
        | typeof AUTH_LOG_REASONS.LOGIN_FAILURE_STREAK
        | typeof AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT;
      maskedEmail?: string;
      maskedIp?: string;
    }
  | { type: "completed" }
  | {
      type: "failed";
      reasonCode:
        | typeof AUTH_LOG_REASONS.INVALID_CREDENTIALS
        | typeof AUTH_LOG_REASONS.IP_UNAVAILABLE
        | typeof AUTH_LOG_REASONS.PROVIDER_ERROR
        | typeof AUTH_LOG_REASONS.INTERNAL_ERROR;
      maskedEmail?: string;
      errorMessage?: string;
      errorName?: string;
    };

/**
 * 로그인 핵심 로직 반환값.
 */
type ResolveLoginResult = {
  response: Response;
  outcome: LoginTerminalOutcome;
};

/**
 * 로그인 핵심 로직.
 *
 * trusted IP와 Auth Global request guard는 body parsing 전에 확인한다.
 * Global guard를 통과한 뒤 기존 입력 검증과 operation-specific Login limiter,
 * Provider lifecycle을 그대로 수행한다.
 *
 * @param request 요청 객체
 * @param validatedRedirect 검증된 성공 redirect 경로
 * @returns 외부 응답과 structured logging용 terminal outcome
 */
async function resolveLoginResponse(
  request: NextRequest,
  validatedRedirect: string,
): Promise<ResolveLoginResult> {
  const trustedIp = getTrustedAuthClientIp(request);

  if (!trustedIp.available) {
    return {
      response: failureResponse(AUTH_API_CODES.LOGIN_INTERNAL_ERROR),
      outcome: {
        type: "failed",
        reasonCode: trustedIp.reasonCode,
      },
    };
  }

  const { ip } = trustedIp;
  const maskedIp = maskIpForLogging(ip);
  const globalRateLimitResult = authGlobalRequestRateLimit.tryConsume({ ip });

  if (!globalRateLimitResult.allowed) {
    return {
      response: failureResponse(AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED),
      outcome: {
        type: "blocked",
        reasonCode: AUTH_LOG_REASONS.AUTH_GLOBAL_IP_LIMIT,
        maskedIp,
      },
    };
  }

  let body: unknown;

  try {
    body = await parseAuthJsonRequestBody(request);
  } catch (error) {
    if (error instanceof AuthJsonParseError) {
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

    throw error;
  }

  // 입력 형식과 extra field를 Provider 준비 전에 검증한다.
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
  const canonicalEmail = canonicalizeEmail(email);
  const maskedEmail = maskEmailForLogging(canonicalEmail);

  /**
   * Provider client는 attempt 소비 전에 준비한다.
   *
   * 이 local 준비가 실패하면 실제 Provider operation이 시작되지 않았으므로
   * Email/IP total attempt를 소비하지 않는다.
   */
  const supabase = await createClient();

  /**
   * 실제 Provider 호출 직전에 quota/streak를 atomic하게 확인하고
   * 허용된 경우 Email/IP attempt를 소비한다.
   */
  const rateLimitResult = loginRateLimit.tryStartAttempt({
    canonicalEmail,
    ip,
  });

  if (!rateLimitResult.allowed) {
    return {
      response: failureResponse(AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED),
      outcome: {
        type: "blocked",
        reasonCode: mapLoginBlockedByToReason(rateLimitResult.blockedBy),
        maskedEmail,
        ...(rateLimitResult.blockedBy === "ip_short" ||
        rateLimitResult.blockedBy === "ip_long"
          ? { maskedIp }
          : {}),
      },
    };
  }

  /**
   * tryStartAttempt 성공 뒤에는 다른 await/I/O를 끼우지 않고
   * 바로 실제 Password Login Provider operation을 시작한다.
   */
  let authResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;

  try {
    authResult = await supabase.auth.signInWithPassword({
      email,
      password,
    });
  } catch (error) {
    // Provider operation은 시작되었으므로 total/IP attempt는 rollback하지 않는다.
    loginRateLimit.recordResult({
      canonicalEmail,
      result: "non_credential_failure",
    });

    const { errorMessage, errorName } = normalizeUnknownError(error);

    return {
      response: failureResponse(AUTH_API_CODES.LOGIN_INTERNAL_ERROR),
      outcome: {
        type: "failed",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
        maskedEmail,
        errorMessage,
        errorName,
      },
    };
  }

  const { data: authData, error: authError } = authResult;

  if (authError) {
    /**
     * 명확히 allowlist된 invalid credential만 consecutive failure로 기록한다.
     * unknown Provider 오류를 credential failure로 추정하지 않는다.
     */
    if (isPasswordLoginCredentialFailure(authError)) {
      loginRateLimit.recordResult({
        canonicalEmail,
        result: "credential_failure",
      });

      return {
        response: failureResponse(AUTH_API_CODES.LOGIN_INVALID_CREDENTIALS),
        outcome: {
          type: "failed",
          reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
          maskedEmail,
        },
      };
    }

    /**
     * 이메일 미인증처럼 streak에는 포함하지 않지만 외부에서는
     * 일반 로그인 실패로 숨겨야 하는 명시적 인증 거절을 처리한다.
     */
    if (isPasswordLoginNonCredentialAuthFailure(authError)) {
      loginRateLimit.recordResult({
        canonicalEmail,
        result: "non_credential_failure",
      });

      return {
        response: failureResponse(AUTH_API_CODES.LOGIN_INVALID_CREDENTIALS),
        outcome: {
          type: "failed",
          reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
          maskedEmail,
        },
      };
    }

    const providerClassification = classifyAuthProviderError(authError);

    // Provider 429/system/unknown error는 기존 streak를 증가시키거나 clear하지 않는다.
    loginRateLimit.recordResult({
      canonicalEmail,
      result: "non_credential_failure",
    });

    if (providerClassification === "provider_rate_limit") {
      return {
        // Local Rate Limit과 동일한 외부 observable contract를 사용한다.
        response: failureResponse(AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED),
        outcome: {
          type: "blocked",
          reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
          maskedEmail,
          maskedIp,
        },
      };
    }

    const { errorMessage, errorName } = normalizeUnknownError(authError);

    return {
      response: failureResponse(AUTH_API_CODES.LOGIN_INTERNAL_ERROR),
      outcome: {
        type: "failed",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
        maskedEmail,
        errorMessage,
        errorName,
      },
    };
  }

  const userId = authData.user?.id;
  if (!userId) {
    // Provider는 응답했지만 인증 성공으로 확정할 수 없는 비정상 결과다.
    loginRateLimit.recordResult({
      canonicalEmail,
      result: "non_credential_failure",
    });

    return {
      response: failureResponse(AUTH_API_CODES.LOGIN_INTERNAL_ERROR),
      outcome: {
        type: "failed",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
        maskedEmail,
      },
    };
  }

  // 유효한 authenticated user가 확인된 시점에 Password 인증 성공이 확정된다.
  loginRateLimit.recordResult({
    canonicalEmail,
    result: "success",
  });

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
 * 로그인 API 핸들러.
 *
 * REQUESTED 이후 각 요청은 정확히 하나의 terminal event로 종료하며,
 * 외부 응답에는 minimum response time 정책을 일괄 적용한다.
 *
 * @param request 로그인 POST 요청
 * @returns Login API 응답
 */
export async function POST(request: NextRequest) {
  const start = Date.now();

  logRequested(AUTH_EVENTS.AUTH_LOGIN_REQUESTED, {
    path: request.nextUrl.pathname,
    method: request.method,
    provider: "email",
  });

  // 성공 후 redirect query는 기존 검증 정책을 그대로 유지한다.
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

  // REQUESTED 이후 정확히 하나의 terminal event만 기록한다.
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
