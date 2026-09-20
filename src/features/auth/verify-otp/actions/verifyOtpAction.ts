"use server";

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";
import { VALIDATION_MESSAGES } from "@/lib/validation/messages";
import { otpSchema } from "@/lib/validation/otpSchema";

import { AUTH_EVENTS } from "../../constants/authEvents";
import {
  AUTH_LOG_REASONS,
  AuthLogReason,
} from "../../constants/authLogReasons";
import { AUTH_PROVIDER_TIMEOUT_MS } from "../../constants/authProviderTimeout";
import { INVALID_OTP_ERROR_MESSAGE } from "../../constants/otp";
import { VERIFY_OTP_PATH } from "../../constants/routes";
import { applyMinimumActionDelay } from "../../lib/applyMinimumActionDelay";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
  normalizeUnknownError,
} from "../../lib/authLogger";
import { createAuthProviderTimeoutContext } from "../../lib/authProviderTimeout";
import {
  classifyAuthProviderError,
  isOtpValidityFailure,
} from "../../lib/classifyAuthProviderError";
import { maskEmailForLogging } from "../../lib/maskEmailForLogging";
import { maskIpForLogging } from "../../lib/maskIpForLogging";
import { authGlobalRequestRateLimit } from "../../lib/rate-limit/authGlobalRequestRateLimit";
import {
  otpVerifyRateLimit,
  OtpVerifyRateLimitBlockedBy,
} from "../../lib/rate-limit/otpVerifyRateLimit";
import { getTrustedAuthServerActionClientIp } from "../../lib/rate-limit/trustedAuthClientIp";
import { createSetPasswordIntent } from "../../lib/setPasswordIntent";
import { createSignedResetPasswordIntent } from "../../lib/signedResetPasswordIntent";
import { validateRedirectPath } from "../../lib/validateRedirectPath";
import { canonicalizeEmail } from "../../utils/canonicalizeEmail";
import { verifyOtp } from "../lib/verifyOtp";
import { verifyOtpContextSchema } from "../schemas/verifyOtpContextSchema";
import { VerifyOtpActionState } from "./verifyOtpActionState";

function blockedState(): VerifyOtpActionState {
  return {
    status: "blocked",
    fieldErrors: null,
  };
}

function internalErrorState(): VerifyOtpActionState {
  return {
    status: "internal_error",
    fieldErrors: null,
  };
}

function mapOtpVerifyBlockedByToReason(
  blockedBy: OtpVerifyRateLimitBlockedBy,
): AuthLogReason {
  switch (blockedBy) {
    case "email_total":
      return AUTH_LOG_REASONS.OTP_VERIFY_EMAIL_LIMIT;
    case "ip_short":
    case "ip_long":
      return AUTH_LOG_REASONS.OTP_VERIFY_IP_LIMIT;
    case "failure_streak":
      return AUTH_LOG_REASONS.OTP_VERIFY_FAILURE_STREAK;
    default: {
      const exhaustiveCheck: never = blockedBy;
      return exhaustiveCheck;
    }
  }
}

/**
 * OTP 인증 입력을 처리하는 Server Action.
 *
 * redirectPath는 formData가 아니라 페이지/컴포넌트에서 bind로 주입되는 값이다.
 * prevState는 useActionState 계약을 맞추기 위한 이전 action state이며,
 * 현재 로직에서는 직접 사용하지 않기 때문에 _prevState로 표시한다.
 */
export async function verifyOtpAction(
  redirectPath: string | null,
  _prevState: VerifyOtpActionState,
  formData: FormData,
): Promise<VerifyOtpActionState> {
  // applyMinimumDelay를 위한 시작 시간
  const start = Date.now();

  // 요청 시작 로그
  logRequested(AUTH_EVENTS.AUTH_VERIFY_OTP_REQUESTED, {
    path: VERIFY_OTP_PATH,
    method: "POST",
    provider: "password",
  });

  let nextUrl = null;

  try {
    /**
     * 요청 컨텍스트 검증
     *
     * email, purpose, redirect는 사용자가 OTP 입력창에서 직접 수정하는 값이 아니라
     * verify-otp 요청을 처리하기 위해 필요한 hidden/context 값이다.
     *
     * 이 값들이 누락되었거나 변조된 경우에는
     * OTP 검증 자체를 진행할 수 없으므로 invalid_input이 아니라
     * invalid_request 상태로 처리한다.
     *
     * invalid_request 상태를 받은 클라이언트는 현재 OTP 화면에 머무르지 않고
     * router.back() 또는 resend-email fallback 처리를 수행해야 한다.
     */
    const contextParsed = verifyOtpContextSchema.safeParse({
      email: formData.get("email"),
      purpose: formData.get("purpose"),
      redirect: redirectPath || undefined,
    });

    if (!contextParsed.success) {
      logAuthEvent(AUTH_EVENTS.AUTH_VERIFY_OTP_INVALID_REQUEST, {
        path: VERIFY_OTP_PATH,
        method: "POST",
        status: 400,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      });

      return {
        status: "invalid_request",
        fieldErrors: null,
      };
    }

    const { email, purpose, redirect: redirectTo } = contextParsed.data;

    /**
     * 사용자 입력 검증
     *
     * OTP는 사용자가 직접 입력하고 수정할 수 있는 값이므로
     * 형식 검증 실패 시 invalid_input 상태로 처리한다.
     *
     * 검증 실패 시에는 현재 OTP 입력 화면을 유지하며
     * fieldErrors를 통해 사용자에게 입력 오류를 표시한다.
     *
     * 검증 대상:
     * - OTP 길이
     * - 숫자 형식 여부
     */
    const otpParsed = otpSchema.safeParse(formData.get("otp"));

    if (!otpParsed.success) {
      logAuthEvent(AUTH_EVENTS.AUTH_VERIFY_OTP_INVALID_INPUT, {
        path: VERIFY_OTP_PATH,
        method: "POST",
        status: 422,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      });

      return {
        status: "invalid_input",
        fieldErrors: {
          otp:
            otpParsed.error.flatten().formErrors[0] ??
            VALIDATION_MESSAGES.otpInvalid,
        },
      };
    }

    const canonicalEmail = canonicalizeEmail(email);
    const maskedEmail = maskEmailForLogging(canonicalEmail);
    const trustedIp = await getTrustedAuthServerActionClientIp();

    if (!trustedIp.available) {
      logAuthError(AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED, {
        path: VERIFY_OTP_PATH,
        method: "POST",
        status: 503,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.IP_UNAVAILABLE,
        maskedEmail,
        purpose,
      });

      return internalErrorState();
    }

    const clientIp = trustedIp.ip;
    const maskedIp = maskIpForLogging(clientIp);
    const globalRateLimitResult = authGlobalRequestRateLimit.tryConsume({
      ip: clientIp,
    });

    if (!globalRateLimitResult.allowed) {
      logAuthEvent(AUTH_EVENTS.AUTH_VERIFY_OTP_RATE_LIMITED, {
        path: VERIFY_OTP_PATH,
        method: "POST",
        status: 429,
        provider: "password",
        result: "blocked",
        reasonCode: AUTH_LOG_REASONS.AUTH_GLOBAL_IP_LIMIT,
        maskedEmail,
        maskedIp,
      });

      return blockedState();
    }

    // operation-specific attempt를 소비하기 전에 timeout-enabled Supabase client를 준비한다.
    const providerTimeout = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });
    const supabase = await createClient({ fetch: providerTimeout.fetch });

    /**
     * Rate limit 검증
     *
     * 요청 컨텍스트 검증을 통과한 email을 canonicalEmail로 정규화한 뒤,
     * IP와 email 기준으로 verify-otp 요청 가능 여부를 확인한다.
     *
     * canonicalEmail은 rate limit key로 사용하고,
     * maskedEmail / maskedIp는 로그에만 사용한다.
     *
     * 요청 제한에 걸린 경우에는 Supabase verifyOtp를 호출하지 않고
     * blocked 상태를 반환한다.
     */
    const attempt = otpVerifyRateLimit.tryStartAttempt({
      purpose,
      canonicalEmail,
      ip: clientIp,
    });

    if (!attempt.allowed) {
      const reasonCode = mapOtpVerifyBlockedByToReason(attempt.blockedBy);

      logAuthEvent(AUTH_EVENTS.AUTH_VERIFY_OTP_RATE_LIMITED, {
        path: VERIFY_OTP_PATH,
        method: "POST",
        status: 429,
        provider: "password",
        result: "blocked",
        reasonCode,
        maskedEmail,
        maskedIp,
      });

      return blockedState();
    }

    /**
     * Supabase OTP 인증 검증 수행
     *
     * 검증된 요청 컨텍스트(email, purpose)와 사용자 입력 OTP를 기반으로
     * Supabase verifyOtp를 호출한다.
     *
     * 주의:
     * - verifyOtp는 throw 대신 error 객체를 반환할 수 있으므로
     *   반드시 반환 결과의 error 여부를 확인해야 한다.
     * - OTP 불일치/만료 error와 Provider 오류는 caller에서 구분한다.
     */
    let verifyResult: Awaited<ReturnType<typeof verifyOtp>>;

    try {
      try {
        verifyResult = await verifyOtp({
          supabase,
          email,
          purpose,
          otp: otpParsed.data,
        });
      } finally {
        // Response body 소비까지 포함한 Provider operation 종료 시점에 attribution을 freeze한다.
        providerTimeout.settle();
      }
    } catch (providerError) {
      otpVerifyRateLimit.recordResult({
        canonicalEmail,
        outcome: "provider_error",
      });

      const normalized = normalizeUnknownError(providerError);

      logAuthError(AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED, {
        path: VERIFY_OTP_PATH,
        method: "POST",
        status: 500,
        provider: "password",
        result: "failure",
        reasonCode: providerTimeout.didTimeout()
          ? AUTH_LOG_REASONS.PROVIDER_TIMEOUT
          : AUTH_LOG_REASONS.PROVIDER_ERROR,
        maskedEmail,
        maskedIp,
        purpose,
        ...normalized,
      });

      return internalErrorState();
    }

    const { data, error } = verifyResult;

    /**
     * OTP 인증 실패 처리
     *
     * Supabase verifyOtp의 error는 throw가 아니라 반환값으로 전달될 수 있다.
     * Supabase Auth가 transport timeout을 wrapped error로 반환할 수 있으므로
     * OTP validity/provider error shape보다 request-scoped timeout context를 먼저 본다.
     */
    if (error) {
      if (providerTimeout.didTimeout()) {
        otpVerifyRateLimit.recordResult({
          canonicalEmail,
          outcome: "provider_error",
        });

        const normalized = normalizeUnknownError(error);

        logAuthError(AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED, {
          path: VERIFY_OTP_PATH,
          method: "POST",
          status: 500,
          provider: "password",
          result: "failure",
          reasonCode: AUTH_LOG_REASONS.PROVIDER_TIMEOUT,
          maskedEmail,
          maskedIp,
          purpose,
          ...normalized,
        });

        return internalErrorState();
      }

      if (isOtpValidityFailure(error)) {
        otpVerifyRateLimit.recordResult({
          canonicalEmail,
          outcome: "otp_failure",
        });

        logAuthEvent(AUTH_EVENTS.AUTH_VERIFY_OTP_INVALID_OTP, {
          path: VERIFY_OTP_PATH,
          method: "POST",
          status: 401,
          provider: "password",
          result: "failure",
          reasonCode: AUTH_LOG_REASONS.INVALID_OTP,
          maskedEmail,
          maskedIp,
          purpose,
        });

        return {
          status: "invalid_otp",
          formError: INVALID_OTP_ERROR_MESSAGE,
        };
      }

      const classification = classifyAuthProviderError(error);

      if (classification === "provider_rate_limit") {
        otpVerifyRateLimit.recordResult({
          canonicalEmail,
          outcome: "provider_rate_limited",
        });

        logAuthEvent(AUTH_EVENTS.AUTH_VERIFY_OTP_RATE_LIMITED, {
          path: VERIFY_OTP_PATH,
          method: "POST",
          status: 429,
          provider: "password",
          result: "blocked",
          reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
          maskedEmail,
          maskedIp,
          purpose,
        });

        return blockedState();
      }

      otpVerifyRateLimit.recordResult({
        canonicalEmail,
        outcome: "provider_error",
      });

      const normalized = normalizeUnknownError(error);

      logAuthError(AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED, {
        path: VERIFY_OTP_PATH,
        method: "POST",
        status: 500,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
        maskedEmail,
        maskedIp,
        purpose,
        ...normalized,
      });

      return internalErrorState();
    }

    let verifiedSignupUserId: string | null = null;
    let verifiedResetPasswordUserId: string | null = null;

    if (purpose === "signup") {
      const verifiedUser = data.user;

      if (verifiedUser === null) {
        throw new Error(
          "Signup OTP verification succeeded without an authenticated user.",
        );
      }

      verifiedSignupUserId = verifiedUser.id;
    } else if (purpose === "reset-password") {
      const verifiedUser = data.user;

      if (verifiedUser === null) {
        throw new Error(
          "Recovery OTP verification succeeded without an authenticated user.",
        );
      }

      verifiedResetPasswordUserId = verifiedUser.id;
    }

    otpVerifyRateLimit.recordResult({
      canonicalEmail,
      outcome: "success",
    });

    /**
     * OTP 인증 완료 로그
     *
     * Supabase verifyOtp가 성공적으로 완료된 상태를 기록한다.
     * purpose는 어떤 OTP 인증 흐름이 성공했는지 운영 로그에서 구분하기 위해 함께 기록한다.
     * OTP 자체는 민감 정보이므로 로그에 남기지 않는다.
     */
    logAuthEvent(AUTH_EVENTS.AUTH_VERIFY_OTP_COMPLETED, {
      path: VERIFY_OTP_PATH,
      method: "POST",
      status: 200,
      provider: "password",
      result: "success",
      purpose,
      maskedEmail,
      maskedIp,
    });

    /**
     * OTP 인증 성공 후 이동 경로 결정.
     *
     * signup:
     * - redirect를 strong validator로 다시 정규화한다.
     * - 정규화된 destination을 Set Password Intent의 signed redirectPath로 저장한다.
     * - /set-password URL에는 final redirect query를 더 이상 전달하지 않는다.
     *
     * reset-password:
     * - 기존 Reset Password Intent와 query 기반 redirect lifecycle을 유지한다.
     */
    if (verifiedSignupUserId !== null) {
      const signedRedirectPath = validateRedirectPath(redirectTo);

      await createSetPasswordIntent({
        userId: verifiedSignupUserId,
        redirectPath: signedRedirectPath,
      });

      nextUrl = ROUTES.SET_PASSWORD;
    } else if (verifiedResetPasswordUserId !== null) {
      await createSignedResetPasswordIntent({
        userId: verifiedResetPasswordUserId,
      });

      nextUrl = redirectTo
        ? `${ROUTES.RESET_PASSWORD}?redirect=${encodeURIComponent(redirectTo)}`
        : ROUTES.RESET_PASSWORD;
    } else {
      nextUrl = ROUTES.SET_PASSWORD;
    }
  } catch (error) {
    /**
     * 예상하지 못한 시스템 예외 처리
     *
     * Provider operation에서 발생한 반환 error와 throw는
     * 위의 Provider 경계에서 별도로 분류한다.
     *
     * 이 catch는 Provider operation 밖에서 발생한
     * 예상하지 못한 시스템 예외를 처리한다.
     */
    const normalized = normalizeUnknownError(error);

    logAuthError(AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED, {
      path: VERIFY_OTP_PATH,
      method: "POST",
      status: 500,
      provider: "password",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      ...normalized,
    });

    return internalErrorState();
  } finally {
    await applyMinimumActionDelay(start);
  }

  redirect(nextUrl);
}
