"use server";

import { redirect } from "next/navigation";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { FORGOT_PASSWORD_PATH } from "@/features/auth/constants/routes";
import {
  type IssueOtpAndSendEmailDiagnostic,
  type IssueOtpAndSendEmailFailureKind,
  issueOtpAndSendEmailWithResult,
} from "@/features/auth/email/issueOtpAndSendEmail";
import { forgotPasswordActionSchema } from "@/features/auth/forgot-password/schemas/forgotPasswordActionSchema";
import { applyMinimumActionDelay } from "@/features/auth/lib/applyMinimumActionDelay";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
  normalizeUnknownError,
} from "@/features/auth/lib/authLogger";
import { createOtpIssueClient } from "@/features/auth/lib/issueOtp";
import { maskEmailForLogging } from "@/features/auth/lib/maskEmailForLogging";
import { maskIpForLogging } from "@/features/auth/lib/maskIpForLogging";
import { authGlobalRequestRateLimit } from "@/features/auth/lib/rate-limit/authGlobalRequestRateLimit";
import {
  otpIssueRateLimit,
  type OtpIssueRateLimitBlockedBy,
} from "@/features/auth/lib/rate-limit/otpIssueRateLimit";
import { getTrustedAuthServerActionClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";
import { ROUTES } from "@/lib/constants/routes";
import { VALIDATION_MESSAGES } from "@/lib/validation/messages";

import { ForgotPasswordActionState } from "./forgotPasswordActionState";

/**
 * OTP Issue local Rate Limit 차단 원인을 기존 structured log reason으로 변환한다.
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

function internalErrorState(): ForgotPasswordActionState {
  return {
    status: "internal_error",
    reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
    fieldErrors: null,
  };
}

/**
 * Recovery OTP Issue 실패를 내부 로그에만 기록한다.
 *
 * Recovery는 Provider/System/Delivery 실패를 외부에 노출하지 않고
 * 기존 success-like redirect 계약을 유지한다.
 */
function logRecoveryOtpIssueFailure(
  kind: IssueOtpAndSendEmailFailureKind,
  diagnostic: IssueOtpAndSendEmailDiagnostic,
  maskedEmail: string,
  maskedIp: string,
): void {
  if (kind === "provider_rate_limit") {
    logAuthEvent(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_RATE_LIMITED, {
      path: FORGOT_PASSWORD_PATH,
      method: "POST",
      status: 429,
      provider: "password",
      result: "blocked",
      reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
      maskedEmail,
      maskedIp,
      ...diagnostic,
    });
    return;
  }

  logAuthError(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED, {
    path: FORGOT_PASSWORD_PATH,
    method: "POST",
    status: 500,
    provider: "password",
    result: "failure",
    reasonCode:
      kind === "delivery_error"
        ? AUTH_LOG_REASONS.EMAIL_DELIVERY_ERROR
        : AUTH_LOG_REASONS.PROVIDER_ERROR,
    maskedEmail,
    maskedIp,
    ...diagnostic,
  });
}

export async function forgotPasswordAction(
  redirectPath: string | null,
  _prevState: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const start = Date.now();

  logRequested(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_REQUESTED, {
    path: FORGOT_PASSWORD_PATH,
    method: "POST",
    provider: "password",
  });

  let verifyOtpUrl: string | null = null;

  try {
    const rawEmail = formData.get("email");
    const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

    const parsed = forgotPasswordActionSchema.safeParse({ email });
    if (!parsed.success) {
      logAuthEvent(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_INVALID_INPUT, {
        path: FORGOT_PASSWORD_PATH,
        method: "POST",
        status: 422,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      });
      return {
        status: "invalid_input",
        fieldErrors: {
          email: [
            email.length === 0
              ? VALIDATION_MESSAGES.emailRequired
              : VALIDATION_MESSAGES.emailInvalid,
          ],
        },
      };
    }

    const canonicalEmail = canonicalizeEmail(parsed.data.email);
    const maskedEmail = maskEmailForLogging(canonicalEmail);
    const trustedIp = await getTrustedAuthServerActionClientIp();

    if (!trustedIp.available) {
      logAuthError(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED, {
        path: FORGOT_PASSWORD_PATH,
        method: "POST",
        status: 500,
        provider: "password",
        result: "failure",
        reasonCode: trustedIp.reasonCode,
        maskedEmail,
      });
      return internalErrorState();
    }

    const { ip } = trustedIp;
    const maskedIp = maskIpForLogging(ip);
    const params = new URLSearchParams({
      purpose: "reset-password",
      email,
    });

    if (redirectPath) {
      params.set("redirect", redirectPath);
    }

    verifyOtpUrl = `${ROUTES.VERIFY_OTP}?${params.toString()}`;

    const globalRateLimitResult = authGlobalRequestRateLimit.tryConsume({ ip });

    if (!globalRateLimitResult.allowed) {
      logAuthEvent(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_RATE_LIMITED, {
        path: FORGOT_PASSWORD_PATH,
        method: "POST",
        status: 429,
        provider: "password",
        result: "blocked",
        reasonCode: AUTH_LOG_REASONS.AUTH_GLOBAL_IP_LIMIT,
        maskedEmail,
        maskedIp,
      });
    } else {
      // Recovery는 client 준비 단계의 system failure도 success-like로 숨긴다.
      try {
        // client와 typed input은 OTP Issue operation-specific Rate Limit 획득 전에 준비한다.
        const otpIssueClient = createOtpIssueClient();
        const otpIssueInput = {
          email,
          purpose: "reset-password" as const,
        };

        const rateLimitResult = otpIssueRateLimit.tryStartIssue({
          purpose: "reset-password",
          canonicalEmail,
          ip,
        });

        if (!rateLimitResult.allowed) {
          logAuthEvent(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_RATE_LIMITED, {
            path: FORGOT_PASSWORD_PATH,
            method: "POST",
            status: 429,
            provider: "password",
            result: "blocked",
            reasonCode: mapOtpIssueBlockedByToReason(rateLimitResult.blockedBy),
            maskedEmail,
            maskedIp,
          });
        } else {
          try {
            // 허용 직후 다른 await/I/O 없이 Provider operation을 시작한다.
            const issueResult = await issueOtpAndSendEmailWithResult(
              otpIssueInput,
              otpIssueClient,
            );

            if (issueResult.ok) {
              otpIssueRateLimit.recordSuccessfulIssue({
                purpose: "reset-password",
                canonicalEmail,
              });

              logAuthEvent(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_COMPLETED, {
                path: FORGOT_PASSWORD_PATH,
                method: "POST",
                status: 200,
                provider: "password",
                result: "success",
                maskedEmail,
                maskedIp,
              });
            } else {
              logRecoveryOtpIssueFailure(
                issueResult.kind,
                issueResult.diagnostic,
                maskedEmail,
                maskedIp,
              );
            }
          } finally {
            // in-flight를 실제로 획득한 경우에만 release한다.
            otpIssueRateLimit.releaseIssue({
              purpose: "reset-password",
              canonicalEmail,
            });
          }
        }
      } catch (error) {
        // client 준비 실패를 포함한 Recovery 내부 system failure는 외부에 숨긴다.
        const normalized = normalizeUnknownError(error);
        logAuthError(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED, {
          path: FORGOT_PASSWORD_PATH,
          method: "POST",
          status: 500,
          provider: "password",
          result: "failure",
          reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
          maskedEmail,
          maskedIp,
          ...normalized,
        });
      }
    }
  } catch (error) {
    const normalized = normalizeUnknownError(error);
    logAuthError(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED, {
      path: FORGOT_PASSWORD_PATH,
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

  // Recovery는 Local RL / Provider / Delivery 실패도 account enumeration 방지를 위해 success-like redirect한다.
  redirect(verifyOtpUrl!);
}
