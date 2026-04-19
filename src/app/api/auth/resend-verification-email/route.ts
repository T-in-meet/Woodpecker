import { NextRequest } from "next/server";

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
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { mapAuthValidationErrors } from "@/features/auth/lib/mapAuthValidationErrors";
import { maskEmailForLogging } from "@/features/auth/lib/maskEmailForLogging";
import {
  AuthJsonParseError,
  parseAuthJsonRequestBody,
} from "@/features/auth/lib/parseAuthJsonRequestBody";
import { resendVerificationEmail } from "@/features/auth/resend-verification-email/lib/resendVerificationEmail";
import { resendApiSchema } from "@/features/auth/resend-verification-email/schema/resendApiSchema";
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";
import { failureResponse, successResponse } from "@/lib/api/response";
import { getClientIp } from "@/lib/utils/getClientIp";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

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
 * 보안 — Account Enumeration 방어:
 * - 이메일 존재 여부에 따른 응답 시간 차이 제거
 * - 모든 분기(성공/실패/rate-limit)에서 동일한 최소 응답 시간 정책 적용
 * - signup API와 동일한 timing normalization (MIN_RESPONSE_MS=400ms)
 * - 공격자가 응답 시간 차이로 계정 존재 여부를 추론할 수 없도록 보장
 *
 * 설계 변경:
 * - cooldown timestamp 모델 제거 (email short window로 대체)
 * - 단일 entry point: checkRequestEligibility로 모든 rate limit 정책 처리
 * - atomic: 판단과 상태 업데이트가 함수 내에서 함께 일어남
 */
type ResendTerminalOutcome =
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
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG;
      maskedEmail?: string;
    }
  | { type: "completed" };

type ResolveResendResult = {
  response: Response;
  outcome: ResendTerminalOutcome;
};

async function resolveResendResponse(
  request: NextRequest,
): Promise<ResolveResendResult> {
  /**
   * 1. IP 추출
   *
   * - request eligibility check를 위해 필요
   * - user-scoped 정책 (IP + email)에 기여
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
    return {
      response: failureResponse(AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED),
      outcome: {
        type: "blocked",
        reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP,
      },
    };
  }

  let body: unknown;

  /**
   * 2. JSON 파싱
   *
   * - Content-Type은 JSON이지만 body가 깨진 경우 방어
   * - validation 이전 단계이므로 field는 "body"로 처리
   */
  try {
    body = await parseAuthJsonRequestBody(request);
  } catch (e) {
    if (e instanceof AuthJsonParseError) {
      return {
        response: failureResponse(AUTH_API_CODES.RESEND_INVALID_INPUT, {
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
   * 3. Zod validation
   *
   * - email trim + 필수값(min 1) + 이메일 형식 검증
   * - 실패 시 INVALID_INPUT 반환
   */
  const parsed = resendApiSchema.safeParse(body);

  if (!parsed.success) {
    return {
      response: failureResponse(AUTH_API_CODES.RESEND_INVALID_INPUT, {
        errors: mapAuthValidationErrors(parsed.error, body),
      }),
      outcome: {
        type: "invalid_input",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      },
    };
  }

  const rawEmail = parsed.data.email;

  /**
   * 4. 이메일 정규화
   *
   * - canonicalizeEmail으로 단일 정규화 진입점 사용
   * - Gmail alias를 동일 identity로 취급
   * - request eligibility key 일관성 유지
   */
  const canonicalEmail = canonicalizeEmail(rawEmail);

  /**
   * 5. Request eligibility check — 통합 판별
   *
   * 설계:
   * - 단일 진입점(single entry point): checkRequestEligibility(route, ip, email)
   * - 원자성(atomic): 판단과 상태 업데이트가 함수 내에서 함께 일어남
   * - AND 평가: IP, email short, email long 모두 통과해야 허용
   * - cooldown timestamp 제거: email short window로 대체 (즉시 재시도 억제)
   * - 차단 시 blockedBy를 반환하며, 로깅은 route handler(여기)에서 담당한다
   */
  const canonicalEmailForLog = maskEmailForLogging(canonicalEmail);
  const eligibility = checkRequestEligibility("resend", ip, canonicalEmail);
  if (!eligibility.allowed) {
    return {
      response: failureResponse(AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED),
      outcome: {
        type: "blocked",
        reasonCode: mapBlockedByToReason(eligibility.blockedBy),
        maskedEmail: canonicalEmailForLog,
      },
    };
  }

  /**
   * 기존 사용자 식별은 canonical 기준, 발송 대상은 raw email 기준으로 분리한다.
   * - 식별: Gmail alias를 동일 identity로 취급하기 위해 canonical_email로 조회
   * - 발송: auth.users에 저장된 실제 이메일(raw)을 사용해 신규 계정 생성/분기 오탐 방지
   */
  const existingUser = await getUserByEmail(canonicalEmail);

  const deliveryEmail = existingUser?.email ?? null;

  /**
   * 6. 인증 메일 재전송
   *
   * 설계 원칙(중요):
   * - 이 라우트는 "외부 응답 계약 통일"을 책임진다.
   * - 따라서 resend 내부 side-effect 실패(user not found, generateLink 실패, 메일 발송 실패 등)는
   *   내부 로깅으로만 처리하고, 외부에는 동일한 성공 계약을 반환한다.
   * - 단, 입력 검증/요청 적격성(rate limit) 실패는 계약된 실패 응답을 그대로 반환한다.
   *
   * 즉, 모든 예외를 무조건 삼키는 것이 아니라
   * "계약 통일이 필요한 구간(side-effect 실행 단계)"의 예외만 의도적으로 흡수한다.
   */
  if (deliveryEmail) {
    await resendVerificationEmail(deliveryEmail);
  }

  /**
   * 7. 성공 응답 반환
   */
  return {
    response: successResponse(
      AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS,
      {
        email: rawEmail,
        resent: true,
      },
    ),
    outcome: { type: "completed" },
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  const start = Date.now();
  logRequested(AUTH_EVENTS.AUTH_RESEND_REQUESTED, {
    path: request.nextUrl.pathname,
    method: request.method,
    provider: "email",
  });

  let resolved: ResolveResendResult;
  try {
    resolved = await resolveResendResponse(request);
  } catch (error) {
    const { errorMessage, errorName } = normalizeUnknownError(error);
    const response = failureResponse(AUTH_API_CODES.RESEND_INTERNAL_ERROR);

    // 현재는 내부 예외를 INTERNAL_ERROR로 정규화한다.
    // 상세 원인은 errorMessage/errorName으로 추적하며, reasonCode는 추후 세분화할 예정이다.
    logAuthError(AUTH_EVENTS.AUTH_RESEND_FAILED, {
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
      });
      break;
    case "completed":
      logAuthEvent(AUTH_EVENTS.AUTH_RESEND_COMPLETED, {
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
