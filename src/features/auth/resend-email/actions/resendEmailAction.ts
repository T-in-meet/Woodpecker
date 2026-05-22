"use server";

import { redirect } from "next/navigation";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { RESEND_EMAIL_PATH } from "@/features/auth/constants/routes";
import { issueOtpAndSendEmail } from "@/features/auth/email/issueOtpAndSendEmail";
import { applyMinimumActionDelay } from "@/features/auth/lib/applyMinimumActionDelay";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
  normalizeUnknownError,
} from "@/features/auth/lib/authLogger";
import {
  checkRequestEligibility,
  mapBlockedByToReason,
} from "@/features/auth/lib/checkRequestEligibility";
import { maskEmailForLogging } from "@/features/auth/lib/maskEmailForLogging";
import { maskIpForLogging } from "@/features/auth/lib/maskIpForLogging";
import { authEmailContextSchema } from "@/features/auth/schemas/authEmailContextSchema";
import { authEmailFormSchema } from "@/features/auth/schemas/authEmailFormSchema";
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";
import { ROUTES } from "@/lib/constants/routes";
import { getServerActionClientIp } from "@/lib/utils/getServerActionClientIp";
import { VALIDATION_MESSAGES } from "@/lib/validation/messages";

import { ResendEmailActionState } from "./resendEmailActionState";

/**
 * rate limit 차단 상태를 생성한다.
 *
 * resend-email action에서는 IP / 이메일 기준 rate limit을
 * 동일한 blocked 상태로 반환하되, 실제 차단 사유는 reasonCode로 구분한다.
 */
function blockedState(
  reasonCode:
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG,
): ResendEmailActionState {
  return {
    status: "blocked",
    reasonCode,
    fieldErrors: null,
  };
}

/**
 * 서버 내부 오류 상태를 생성한다.
 *
 * OTP 발급 실패, 이메일 전송 실패, 예기치 못한 예외 등
 * 사용자가 입력으로 해결할 수 없는 문제에 사용한다.
 */
function internalErrorState(): ResendEmailActionState {
  return {
    status: "internal_error",
    reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
    fieldErrors: null,
  };
}

/**
 * OTP 재전송 action
 *
 * resend-email 페이지에서 사용자가 이메일 재전송을 요청했을 때 실행된다.
 *
 * 처리 흐름:
 * 1. 이전 페이지에서 전달된 context 값 검증
 * 2. 사용자가 입력한 이메일 검증
 * 3. IP / 이메일 기준 rate limit 검증
 * 4. OTP 발급 및 이메일 전송
 * 5. 성공 시 verify-otp 페이지로 이동
 *
 * 보안 정책:
 * - action은 page에서 검증된 query/context를 그대로 신뢰하지 않고 다시 검증한다.
 * - 로그에는 원본 이메일/IP를 남기지 않고 마스킹된 값만 기록한다.
 * - 모든 종료 경로에서 최소 응답 시간을 보장한다.
 */
export async function resendEmailAction(
  redirectPath: string | null,
  _prevState: ResendEmailActionState,
  formData: FormData,
): Promise<ResendEmailActionState> {
  const start = Date.now();

  /**
   * 요청 시작 로그
   */
  logRequested(AUTH_EVENTS.AUTH_RESEND_EMAIL_REQUESTED, {
    path: RESEND_EMAIL_PATH,
    method: "POST",
    provider: "password",
  });

  /**
   * OTP 검증 페이지 이동 경로
   *
   * OTP 발급 및 이메일 전송이 성공한 뒤
   * finally에서 최소 지연을 보장한 다음 redirect에 사용한다.
   */
  let verifyOtpUrl: string | null = null;

  try {
    /**
     * 요청 컨텍스트 검증
     *
     * purpose / redirect는 사용자가 직접 입력한 필드라기보다
     * 이전 인증 흐름에서 전달된 context 값이다.
     *
     * page에서 1차 검증했더라도 action은 직접 호출될 수 있으므로
     * 서버 action 내부에서 다시 검증한다.
     */
    const contextParsed = authEmailContextSchema.safeParse({
      purpose: formData.get("purpose"),
      redirect: redirectPath || undefined,
    });

    if (!contextParsed.success) {
      logAuthEvent(AUTH_EVENTS.AUTH_RESEND_EMAIL_INVALID_REQUEST, {
        path: RESEND_EMAIL_PATH,
        method: "POST",
        status: 400,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      });

      return {
        status: "invalid_request",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
        fieldErrors: null,
      };
    }

    const { purpose, redirect } = contextParsed.data;

    /**
     * 사용자 입력 검증
     *
     * 사용자가 입력한 이메일 값만 검증한다.
     * context 검증과 분리해, field error는 email 입력 필드에만 연결한다.
     */
    const emailParsed = authEmailFormSchema.safeParse({
      email: formData.get("email"),
    });

    if (!emailParsed.success) {
      logAuthEvent(AUTH_EVENTS.AUTH_RESEND_EMAIL_INVALID_INPUT, {
        path: RESEND_EMAIL_PATH,
        method: "POST",
        status: 422,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      });

      return {
        status: "invalid_input",
        fieldErrors: {
          email:
            emailParsed.error.flatten().formErrors ??
            VALIDATION_MESSAGES.emailInvalid,
        },
      };
    }

    const email = emailParsed.data.email;

    /**
     * rate limit 검증
     *
     * 원본 이메일은 실제 OTP 발급/전송에 사용하고,
     * rate limit 및 로깅 기준에는 canonical email과 마스킹 값을 사용한다.
     */
    const canonicalEmail = canonicalizeEmail(email);
    const clientIp = await getServerActionClientIp();
    const maskedEmail = maskEmailForLogging(canonicalEmail);
    const maskedIp = maskIpForLogging(clientIp);

    const eligibility = checkRequestEligibility(
      "resend-email",
      clientIp,
      canonicalEmail,
    );

    if (!eligibility.allowed) {
      const reasonCode = mapBlockedByToReason(eligibility.blockedBy);

      logAuthEvent(AUTH_EVENTS.AUTH_RESEND_EMAIL_RATE_LIMITED, {
        path: RESEND_EMAIL_PATH,
        method: "POST",
        status: 429,
        provider: "password",
        result: "blocked",
        reasonCode,
        maskedEmail,
        maskedIp,
      });

      return blockedState(reasonCode);
    }

    const params = new URLSearchParams({
      purpose, // purpose는 전달받은 그래로 전달
      email,
    });

    if (redirect) {
      params.set("redirect", redirect);
    }

    /**
     * OTP 발급 및 이메일 전송
     *
     * issueOtpAndSendEmail은 실패 시 throw하는 계약을 가진다.
     *
     * reset-password 목적은 계정 존재 여부 노출 방지를 위해
     * 발급/전송 실패를 외부에 드러내지 않는다.
     *
     * signup 목적은 실제 인증 진행 흐름이므로
     * 발급/전송 실패를 internal_error로 처리한다.
     */
    try {
      await issueOtpAndSendEmail({ email, purpose });
    } catch {
      logAuthError(AUTH_EVENTS.AUTH_RESEND_EMAIL_FAILED, {
        path: RESEND_EMAIL_PATH,
        method: "POST",
        status: 500,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        maskedEmail,
        maskedIp,
      });

      if (purpose !== "reset-password") {
        return internalErrorState();
      }
    }

    logAuthEvent(AUTH_EVENTS.AUTH_RESEND_EMAIL_COMPLETED, {
      path: RESEND_EMAIL_PATH,
      method: "POST",
      status: 200,
      provider: "password",
      result: "success",
      maskedEmail,
      maskedIp,
    });

    verifyOtpUrl = `${ROUTES.VERIFY_OTP}?${params.toString()}`;
  } catch (error) {
    /**
     * 예상하지 못한 서버 예외 처리
     *
     * 명시적으로 분기한 검증 실패/rate limit/전송 실패 외의 예외를
     * 내부 오류로 일반화해 반환한다.
     */
    const normalized = normalizeUnknownError(error);
    logAuthError(AUTH_EVENTS.AUTH_RESEND_EMAIL_FAILED, {
      path: RESEND_EMAIL_PATH,
      method: "POST",
      status: 500,
      provider: "password",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      ...normalized,
    });
    return internalErrorState();
  } finally {
    /**
     * 최소 응답 시간 보장
     *
     * 성공/실패 여부와 관계없이 응답 시간이 과도하게 달라지지 않도록 한다.
     */
    await applyMinimumActionDelay(start);
  }

  // 발급 성공 또는 존재하지 않는 이메일 은닉 성공
  redirect(verifyOtpUrl!);
}
