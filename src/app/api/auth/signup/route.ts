import { NextRequest } from "next/server";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import {
  type IssueOtpAndSendEmailDiagnostic,
  type IssueOtpAndSendEmailFailureKind,
  type IssueOtpAndSendEmailInput,
  issueOtpAndSendEmailWithResult,
} from "@/features/auth/email/issueOtpAndSendEmail";
import { applyMinimumResponseTime } from "@/features/auth/lib/applyMinimumResponseTime";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
  normalizeUnknownError,
} from "@/features/auth/lib/authLogger";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { createOtpIssueClient } from "@/features/auth/lib/issueOtp";
import { mapAuthValidationErrors } from "@/features/auth/lib/mapAuthValidationErrors";
import { maskEmailForLogging } from "@/features/auth/lib/maskEmailForLogging";
import { maskIpForLogging } from "@/features/auth/lib/maskIpForLogging";
import {
  AuthJsonParseError,
  parseAuthJsonRequestBody,
} from "@/features/auth/lib/parseAuthJsonRequestBody";
import { authGlobalRequestRateLimit } from "@/features/auth/lib/rate-limit/authGlobalRequestRateLimit";
import {
  otpIssueRateLimit,
  type OtpIssueRateLimitBlockedBy,
} from "@/features/auth/lib/rate-limit/otpIssueRateLimit";
import { getTrustedAuthClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";
import { recordCurrentLegalAcceptances } from "@/features/auth/lib/userAgreements";
import { signupApiSchema } from "@/features/auth/signup/schema/signupApiSchema";
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";
import { failureResponse, successResponse } from "@/lib/api/response";
import { ROUTES } from "@/lib/constants/routes";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

/**
 * Signup OTP Issue local Rate Limit 차단 원인을 structured log reason으로 변환한다.
 *
 * email_success는 Email long reason으로,
 * cooldown/in-flight는 Email short reason으로 기록한다.
 *
 * @param blockedBy OTP Issue Rate Limit 차단 원인
 * @returns 구조화 로그 reason
 */
function mapOtpIssueBlockedByToReason(
  blockedBy: OtpIssueRateLimitBlockedBy,
):
  | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT
  | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG
  | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT
  | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG
  | typeof AUTH_LOG_REASONS.OTP_ISSUE_EMAIL_ATTEMPT_LIMIT {
  switch (blockedBy) {
    case "ip_short":
      return AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT;
    case "ip_long":
      return AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG;
    case "email_success":
      return AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG;
    case "email_attempt":
      return AUTH_LOG_REASONS.OTP_ISSUE_EMAIL_ATTEMPT_LIMIT;
    case "cooldown":
    case "in_flight":
      return AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT;
  }
}

/**
 * 회원가입 요청의 terminal outcome.
 *
 * 외부 응답 code와 내부 structured log reason을 분리하여
 * Local Rate Limit / Provider Rate Limit / Provider/System / Delivery 실패를 구분한다.
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
      reasonCode:
        | typeof AUTH_LOG_REASONS.AUTH_GLOBAL_IP_LIMIT
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG
        | typeof AUTH_LOG_REASONS.OTP_ISSUE_EMAIL_ATTEMPT_LIMIT
        | typeof AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT;
      maskedEmail?: string;
      maskedIp?: string;
      errorMessage?: string;
      errorName?: string;
      errorCode?: string;
    }
  | { type: "completed" }
  | {
      type: "failed";
      reasonCode:
        | typeof AUTH_LOG_REASONS.IP_UNAVAILABLE
        | typeof AUTH_LOG_REASONS.PROVIDER_ERROR
        | typeof AUTH_LOG_REASONS.EMAIL_DELIVERY_ERROR
        | typeof AUTH_LOG_REASONS.INTERNAL_ERROR;
      maskedEmail?: string;
      maskedIp?: string;
      errorMessage?: string;
      errorName?: string;
      errorCode?: string;
    };

/**
 * 회원가입 핵심 로직 반환값.
 */
type ResolveSignupResult = {
  response: Response;
  outcome: SignupTerminalOutcome;
};

type RunSignupOtpIssueBaseInput = {
  requestEmail: string;
  deliveryEmail: string;
  canonicalEmail: string;
  ip: string;
  maskedEmail: string;
  maskedIp: string;
};

/**
 * Signup OTP Issue 실행 입력.
 *
 * 신규 사용자는 generateLink(type: "signup")이 사용자 생성까지 담당하고,
 * 기존 사용자는 magiclink를 발급한다.
 */
type RunSignupOtpIssueInput =
  | (RunSignupOtpIssueBaseInput & {
      signupMode: "new-user";
      password: string;
      nickname: string;
    })
  | (RunSignupOtpIssueBaseInput & {
      signupMode: "existing-user";
      agreementUserId?: string;
    });

/**
 * 회원가입 성공 응답을 생성한다.
 *
 * @param email validation 이후 사용자 입력 이메일
 * @returns 회원가입 성공 응답
 */
function makeSignupSuccess(email: string): Response {
  return successResponse(AUTH_API_CODES.SIGNUP_SUCCESS, {
    email,
    redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent(email)}`,
  });
}

/**
 * Local OTP Issue Rate Limit 차단을 Signup 외부 응답과 로그 outcome으로 변환한다.
 */
function resolveSignupLocalRateLimitBlocked(
  blockedBy: OtpIssueRateLimitBlockedBy,
  maskedEmail: string,
  maskedIp: string,
): ResolveSignupResult {
  return {
    response: failureResponse(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED),
    outcome: {
      type: "blocked",
      reasonCode: mapOtpIssueBlockedByToReason(blockedBy),
      maskedEmail,
      ...(blockedBy === "ip_short" || blockedBy === "ip_long"
        ? { maskedIp }
        : {}),
    },
  };
}

/**
 * typed OTP Issue failure를 Signup 외부 응답과 내부 로그 outcome으로 변환한다.
 *
 * @param kind OTP Issue failure 종류
 * @param diagnostic 안전하게 정규화된 내부 진단 정보
 * @param maskedEmail 마스킹된 canonical email
 * @param maskedIp 마스킹된 trusted IP
 * @returns enumeration-safe Signup 응답과 terminal outcome
 */
function resolveSignupOtpFailure(
  kind: IssueOtpAndSendEmailFailureKind,
  diagnostic: IssueOtpAndSendEmailDiagnostic,
  requestEmail: string,
  maskedEmail: string,
  maskedIp: string,
): ResolveSignupResult {
  if (kind === "provider_rate_limit") {
    return {
      response: makeSignupSuccess(requestEmail),
      outcome: {
        type: "blocked",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
        maskedEmail,
        maskedIp,
        ...diagnostic,
      },
    };
  }

  if (kind === "delivery_error") {
    return {
      response: makeSignupSuccess(requestEmail),
      outcome: {
        type: "failed",
        reasonCode: AUTH_LOG_REASONS.EMAIL_DELIVERY_ERROR,
        maskedEmail,
        maskedIp,
        ...diagnostic,
      },
    };
  }

  return {
    response: makeSignupSuccess(requestEmail),
    outcome: {
      type: "failed",
      reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
      maskedEmail,
      maskedIp,
      ...diagnostic,
    },
  };
}

class SignupAgreementPersistenceError extends Error {
  readonly originalErrorName: string;

  constructor(error: unknown) {
    const { errorMessage, errorName } = normalizeUnknownError(error);

    super(errorMessage);
    this.name = "SignupAgreementPersistenceError";
    this.originalErrorName = errorName;
  }
}

async function recordSignupLegalAcceptances(userId: string): Promise<void> {
  try {
    await recordCurrentLegalAcceptances(userId, "email");
  } catch (error) {
    throw new SignupAgreementPersistenceError(error);
  }
}

/**
 * Signup mode별 typed OTP Issue 입력을 준비한다.
 *
 * 이 함수는 callback과 plain object만 구성하며 외부 I/O를 수행하지 않는다.
 * tryStartIssue() 전에 호출하여 Rate Limit 허용 뒤 Provider operation이
 * 즉시 시작될 수 있게 한다.
 *
 * @param input Signup OTP Issue identity와 account state
 * @returns typed OTP Issue helper 입력
 */
function createSignupOtpIssueInput(
  input: RunSignupOtpIssueInput,
): IssueOtpAndSendEmailInput {
  if (input.signupMode === "new-user") {
    return {
      email: input.deliveryEmail,
      purpose: "signup",
      signupMode: "new-user",
      password: input.password,
      metadata: {
        nickname: input.nickname,
        canonical_email: input.canonicalEmail,
      },
      beforeDelivery: async ({ userId }: { userId: string }) => {
        await recordSignupLegalAcceptances(userId);
      },
    };
  }

  const agreementUserId = input.agreementUserId;

  if (agreementUserId) {
    return {
      email: input.deliveryEmail,
      purpose: "signup",
      signupMode: "existing-user",
      beforeDelivery: async () => {
        await recordSignupLegalAcceptances(agreementUserId);
      },
    };
  }

  return {
    email: input.deliveryEmail,
    purpose: "signup",
    signupMode: "existing-user",
  };
}

/**
 * Signup OTP Issue를 Rate Limit lifecycle에 맞춰 실행한다.
 *
 * client와 caller-specific 입력 준비는 `tryStartIssue()` 전에 끝내고,
 * 허용 직후 다른 await/I/O 없이 typed-result helper를 호출하여
 * 실제 `generateLink()`가 즉시 시작되도록 한다.
 *
 * 성공한 경우에만 successful Email quota를 기록하며,
 * 성공/실패/예외와 관계없이 in-flight는 finally에서 해제한다.
 *
 * @param input Signup OTP Issue identity와 account state
 * @returns Signup OTP Issue 결과
 */
async function runSignupOtpIssue(
  input: RunSignupOtpIssueInput,
): Promise<ResolveSignupResult> {
  const otpIssueClient = createOtpIssueClient();
  const otpIssueInput = createSignupOtpIssueInput(input);

  const rateLimitResult = otpIssueRateLimit.tryStartIssue({
    purpose: "signup",
    canonicalEmail: input.canonicalEmail,
    ip: input.ip,
  });

  if (!rateLimitResult.allowed) {
    return resolveSignupLocalRateLimitBlocked(
      rateLimitResult.blockedBy,
      input.maskedEmail,
      input.maskedIp,
    );
  }

  try {
    // tryStartIssue() 성공 뒤에는 다른 await/I/O 없이 Provider operation을 시작한다.
    const issueResult = await issueOtpAndSendEmailWithResult(
      otpIssueInput,
      otpIssueClient,
    );

    if (!issueResult.ok) {
      return resolveSignupOtpFailure(
        issueResult.kind,
        issueResult.diagnostic,
        input.requestEmail,
        input.maskedEmail,
        input.maskedIp,
      );
    }

    // successful quota는 OTP 발급 + email_otp 검증 + Email delivery 성공 뒤에만 기록한다.
    otpIssueRateLimit.recordSuccessfulIssue({
      purpose: "signup",
      canonicalEmail: input.canonicalEmail,
    });

    return {
      response: makeSignupSuccess(input.requestEmail),
      outcome: { type: "completed" },
    };
  } catch (error) {
    if (!(error instanceof SignupAgreementPersistenceError)) {
      throw error;
    }

    return {
      response: makeSignupSuccess(input.requestEmail),
      outcome: {
        type: "failed",
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        maskedEmail: input.maskedEmail,
        maskedIp: input.maskedIp,
        errorMessage: error.message,
        errorName: error.originalErrorName,
      },
    };
  } finally {
    // 성공 quota 기록보다 먼저 release하지 않는다.
    otpIssueRateLimit.releaseIssue({
      purpose: "signup",
      canonicalEmail: input.canonicalEmail,
    });
  }
}

/**
 * 회원가입 핵심 로직.
 *
 * 처리 순서와 보안 경계:
 * - trusted IP와 Auth Global request guard를 body parsing 전에 확인
 * - global allowed 요청만 malformed JSON / schema validation으로 진입
 * - read-only OTP Issue precheck로 명백히 차단된 요청을 account lookup 전에 종료
 * - canonical email lookup은 account state를 외부에 노출하지 않고 내부 분기에만 사용
 * - 미인증 기존 사용자는 magiclink 발급 전 agreement persistence를 보장
 * - 인증된 기존 사용자는 magiclink를 발급하며 agreement persistence 범위를 확대하지 않음
 * - 신규 사용자는 generateLink(type: "signup")에서 사용자 생성과 OTP 발급을 수행
 *
 * @param request 회원가입 POST 요청
 * @returns 외부 응답과 structured logging용 terminal outcome
 */
async function resolveSignupResponse(
  request: NextRequest,
): Promise<ResolveSignupResult> {
  const trustedIp = getTrustedAuthClientIp(request);

  if (!trustedIp.available) {
    return {
      response: failureResponse(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR),
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
      response: failureResponse(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED),
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
        response: failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
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

  // Global request guard를 통과한 요청의 입력값을 Provider 준비 전에 검증한다.
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
   * Account lookup 전에 현재 OTP Issue 상태를 read-only로 확인한다.
   *
   * blocked는 즉시 거절할 수 있지만 allowed는 Provider 시작 허가가 아니다.
   * account state와 caller input을 준비한 뒤 tryStartIssue()에서 다시
   * atomic하게 최종 판정한다.
   */
  const precheckResult = otpIssueRateLimit.precheckIssue({
    purpose: "signup",
    canonicalEmail,
    ip,
  });

  if (!precheckResult.allowed) {
    return resolveSignupLocalRateLimitBlocked(
      precheckResult.blockedBy,
      maskedEmail,
      maskedIp,
    );
  }

  // 기존 사용자 조회는 account-state 외부 노출 없이 Signup Issue mode를 결정하는 데만 사용한다.
  const existingUser = await getUserByEmail(canonicalEmail);

  if (existingUser) {
    const deliveryEmail = existingUser.email ?? email;

    return runSignupOtpIssue({
      signupMode: "existing-user",
      requestEmail: email,
      deliveryEmail,
      canonicalEmail,
      ip,
      maskedEmail,
      maskedIp,
      ...(existingUser.email_confirmed_at === null
        ? { agreementUserId: existingUser.id }
        : {}),
    });
  }

  /**
   * 신규 사용자는 별도 createUser()를 선행하지 않는다.
   *
   * Local OTP Issue Rate Limit이 허용된 뒤 첫 Provider operation인
   * generateLink(type: "signup")이 사용자 생성과 OTP 발급을 함께 수행한다.
   * 따라서 Local Rate Limit 차단 요청은 사용자 생성 side effect에 도달하지 않는다.
   */
  return runSignupOtpIssue({
    signupMode: "new-user",
    requestEmail: email,
    deliveryEmail: email,
    canonicalEmail,
    ip,
    maskedEmail,
    maskedIp,
    password,
    nickname,
  });
}

/**
 * 회원가입 API.
 *
 * Account Enumeration 방어를 위해 account state가 아니라
 * account-state-dependent failure는 success-like 응답으로 masking하고,
 * account-state-independent failure는 기존 외부 오류 계약을 유지한다.
 *
 * @param request 회원가입 POST 요청
 * @returns 회원가입 API 응답
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
        ...(outcome.errorMessage
          ? {
              errorMessage: outcome.errorMessage,
              errorName: outcome.errorName ?? "UnknownError",
            }
          : {}),
        ...(outcome.errorCode ? { errorCode: outcome.errorCode } : {}),
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

    case "failed":
      logAuthError(AUTH_EVENTS.AUTH_SIGNUP_FAILED, {
        path: request.nextUrl.pathname,
        method: request.method,
        status: response.status,
        provider: "email",
        result: "failure",
        reasonCode: outcome.reasonCode,
        ...(outcome.maskedEmail ? { maskedEmail: outcome.maskedEmail } : {}),
        ...(outcome.maskedIp ? { maskedIp: outcome.maskedIp } : {}),
        ...(outcome.errorMessage
          ? {
              errorMessage: outcome.errorMessage,
              errorName: outcome.errorName ?? "UnknownError",
            }
          : {}),
        ...(outcome.errorCode ? { errorCode: outcome.errorCode } : {}),
      });
      break;
  }

  return applyMinimumResponseTime(start, response);
}
