"use server";

import { redirect } from "next/navigation";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { RESEND_EMAIL_PATH } from "@/features/auth/constants/routes";
import {
  type IssueOtpAndSendEmailDiagnostic,
  type IssueOtpAndSendEmailFailureKind,
  type IssueOtpAndSendEmailInput,
  issueOtpAndSendEmailWithResult,
} from "@/features/auth/email/issueOtpAndSendEmail";
import { applyMinimumActionDelay } from "@/features/auth/lib/applyMinimumActionDelay";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
  normalizeUnknownError,
} from "@/features/auth/lib/authLogger";
import {
  getUserByEmail,
  GetUserByEmailError,
} from "@/features/auth/lib/getUserByEmail";
import { createOtpIssueClient } from "@/features/auth/lib/issueOtp";
import { maskEmailForLogging } from "@/features/auth/lib/maskEmailForLogging";
import { maskIpForLogging } from "@/features/auth/lib/maskIpForLogging";
import { authGlobalRequestRateLimit } from "@/features/auth/lib/rate-limit/authGlobalRequestRateLimit";
import {
  otpIssueRateLimit,
  type OtpIssueRateLimitBlockedBy,
} from "@/features/auth/lib/rate-limit/otpIssueRateLimit";
import { signupResendRequestRateLimit } from "@/features/auth/lib/rate-limit/signupResendRequestRateLimit";
import { getTrustedAuthServerActionClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";
import { recordCurrentLegalAcceptances } from "@/features/auth/lib/userAgreements";
import { authEmailContextSchema } from "@/features/auth/schemas/authEmailContextSchema";
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";
import { ROUTES } from "@/lib/constants/routes";
import { normalizedEmailSchema } from "@/lib/validation/emailSchema";
import { VALIDATION_MESSAGES } from "@/lib/validation/messages";

import { ResendEmailActionState } from "./resendEmailActionState";

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

function blockedState(
  reasonCode:
    | typeof AUTH_LOG_REASONS.AUTH_GLOBAL_IP_LIMIT
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG
    | typeof AUTH_LOG_REASONS.OTP_ISSUE_EMAIL_ATTEMPT_LIMIT,
): ResendEmailActionState {
  return {
    status: "blocked",
    reasonCode,
    fieldErrors: null,
  };
}

function internalErrorState(): ResendEmailActionState {
  return {
    status: "internal_error",
    reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
    fieldErrors: null,
  };
}

/**
 * typed OTP Issue 실패를 Resend 내부 로그에 기록한다.
 */
function logResendOtpIssueFailure(
  kind: IssueOtpAndSendEmailFailureKind,
  diagnostic: IssueOtpAndSendEmailDiagnostic,
  maskedEmail: string,
  maskedIp: string,
): void {
  if (kind === "provider_rate_limit") {
    logAuthEvent(AUTH_EVENTS.AUTH_RESEND_EMAIL_RATE_LIMITED, {
      path: RESEND_EMAIL_PATH,
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

  logAuthError(AUTH_EVENTS.AUTH_RESEND_EMAIL_FAILED, {
    path: RESEND_EMAIL_PATH,
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

/**
 * Resend purpose에 맞는 typed OTP Issue 입력을 준비한다.
 *
 * signup resend는 기존 사용자 magiclink 경로만 사용하며,
 * 미인증 사용자라면 이전 partial failure 복구를 위해 agreement upsert hook을 연결한다.
 */
async function createResendOtpIssueInput(
  email: string,
  purpose: "signup" | "reset-password",
  canonicalEmail: string,
): Promise<IssueOtpAndSendEmailInput | null> {
  if (purpose === "reset-password") {
    return {
      email,
      purpose: "reset-password",
    };
  }

  const existingUser = await getUserByEmail(canonicalEmail);

  // Signup Resend는 기존 사용자에게만 magiclink를 발급한다.
  // 존재하지 않는 이메일은 Provider / Rate Limit side effect 없이 success-like로 처리한다.
  if (!existingUser) {
    return null;
  }

  const deliveryEmail = existingUser.email ?? email;

  if (existingUser.email_confirmed_at === null) {
    return {
      email: deliveryEmail,
      purpose: "signup",
      signupMode: "existing-user",
      beforeDelivery: async () => {
        await recordCurrentLegalAcceptances(existingUser.id, "email");
      },
    };
  }

  return {
    email: deliveryEmail,
    purpose: "signup",
    signupMode: "existing-user",
  };
}

export async function resendEmailAction(
  redirectPath: string | null,
  _prevState: ResendEmailActionState,
  formData: FormData,
): Promise<ResendEmailActionState> {
  const start = Date.now();

  logRequested(AUTH_EVENTS.AUTH_RESEND_EMAIL_REQUESTED, {
    path: RESEND_EMAIL_PATH,
    method: "POST",
    provider: "password",
  });

  let verifyOtpUrl: string | null = null;

  try {
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

    const { purpose, redirect: validatedRedirect } = contextParsed.data;
    const rawEmail = formData.get("email");
    const emailParsed = normalizedEmailSchema.safeParse(rawEmail);

    if (!emailParsed.success) {
      logAuthEvent(AUTH_EVENTS.AUTH_RESEND_EMAIL_INVALID_INPUT, {
        path: RESEND_EMAIL_PATH,
        method: "POST",
        status: 422,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      });

      const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

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

    const email = emailParsed.data;
    const canonicalEmail = canonicalizeEmail(email);
    const maskedEmail = maskEmailForLogging(canonicalEmail);
    const trustedIp = await getTrustedAuthServerActionClientIp();

    if (!trustedIp.available) {
      logAuthError(AUTH_EVENTS.AUTH_RESEND_EMAIL_FAILED, {
        path: RESEND_EMAIL_PATH,
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
      purpose,
      email,
    });

    if (validatedRedirect) {
      params.set("redirect", validatedRedirect);
    }

    verifyOtpUrl = `${ROUTES.VERIFY_OTP}?${params.toString()}`;

    const globalRateLimitResult = authGlobalRequestRateLimit.tryConsume({ ip });

    if (!globalRateLimitResult.allowed) {
      logAuthEvent(AUTH_EVENTS.AUTH_RESEND_EMAIL_RATE_LIMITED, {
        path: RESEND_EMAIL_PATH,
        method: "POST",
        status: 429,
        provider: "password",
        result: "blocked",
        reasonCode: AUTH_LOG_REASONS.AUTH_GLOBAL_IP_LIMIT,
        rateLimitSource: "auth_global",
        maskedEmail,
        maskedIp,
      });

      if (purpose === "signup") {
        return blockedState(AUTH_LOG_REASONS.AUTH_GLOBAL_IP_LIMIT);
      }
    } else {
      /**
       * Signup Resend는 account 존재 여부를 조회하기 전에 shared IP quota만
       * read-only로 확인한다. blocked는 account state와 무관하게 같은
       * blockedState를 반환하며, allowed는 최종 Provider 시작 허가가 아니다.
       *
       * Recovery resend는 account lookup을 선행하지 않고 Local RL도 외부에
       * success-like로 숨기는 기존 계약을 유지하므로 이 precheck를 적용하지 않는다.
       */
      if (purpose === "signup") {
        const ipPrecheckResult = otpIssueRateLimit.precheckIpIssue({ ip });

        if (!ipPrecheckResult.allowed) {
          const reasonCode = mapOtpIssueBlockedByToReason(
            ipPrecheckResult.blockedBy,
          );

          logAuthEvent(AUTH_EVENTS.AUTH_RESEND_EMAIL_RATE_LIMITED, {
            path: RESEND_EMAIL_PATH,
            method: "POST",
            status: 429,
            provider: "password",
            result: "blocked",
            reasonCode,
            rateLimitSource: "otp_issue",
            maskedEmail,
            maskedIp,
          });

          return blockedState(reasonCode);
        }
      }

      if (purpose === "signup") {
        const requestRateLimitResult = signupResendRequestRateLimit.tryConsume({
          ip,
        });

        if (!requestRateLimitResult.allowed) {
          const reasonCode = mapOtpIssueBlockedByToReason(
            requestRateLimitResult.blockedBy,
          );

          logAuthEvent(AUTH_EVENTS.AUTH_RESEND_EMAIL_RATE_LIMITED, {
            path: RESEND_EMAIL_PATH,
            method: "POST",
            status: 429,
            provider: "password",
            result: "blocked",
            reasonCode,
            rateLimitSource: "signup_resend_request",
            maskedEmail,
            maskedIp,
          });

          return blockedState(reasonCode);
        }
      }

      // Signup account lookup은 IP-only precheck와 request limiter를 통과한 뒤,
      // final tryStartIssue() 전에 수행한다.
      let otpIssueInput: IssueOtpAndSendEmailInput | null;
      let maskedAccountLookupFailure = false;

      try {
        otpIssueInput = await createResendOtpIssueInput(
          email,
          purpose,
          canonicalEmail,
        );
      } catch (error) {
        if (
          !(error instanceof GetUserByEmailError) ||
          error.kind !== "auth_user_lookup"
        ) {
          throw error;
        }

        maskedAccountLookupFailure = true;
        otpIssueInput = null;

        logAuthError(AUTH_EVENTS.AUTH_RESEND_EMAIL_FAILED, {
          path: RESEND_EMAIL_PATH,
          method: "POST",
          status: 500,
          provider: "password",
          result: "failure",
          reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
          maskedEmail,
          maskedIp,
          ...normalizeUnknownError(error.cause),
        });
      }

      if (otpIssueInput === null) {
        if (!maskedAccountLookupFailure) {
          // 존재하지 않는 Signup 이메일은 Provider를 시작하지 않고 success-like로 숨긴다.
          // tryStartIssue()를 호출하지 않으므로 cooldown / IP attempt / in-flight도 소비하지 않는다.
          logAuthEvent(AUTH_EVENTS.AUTH_RESEND_EMAIL_COMPLETED, {
            path: RESEND_EMAIL_PATH,
            method: "POST",
            status: 200,
            provider: "password",
            result: "success",
            maskedEmail,
            maskedIp,
          });
        }
      } else {
        // 이 시점에는 Signup account state가 existing으로 확인됐다.
        // 이후 account-dependent failure는 내부 reason/lifecycle만 유지하고
        // 외부에는 success-like redirect로 숨긴다.
        try {
          const otpIssueClient = createOtpIssueClient();
          const rateLimitResult = otpIssueRateLimit.tryStartIssue({
            purpose,
            canonicalEmail,
            ip,
          });

          if (!rateLimitResult.allowed) {
            const reasonCode = mapOtpIssueBlockedByToReason(
              rateLimitResult.blockedBy,
            );

            logAuthEvent(AUTH_EVENTS.AUTH_RESEND_EMAIL_RATE_LIMITED, {
              path: RESEND_EMAIL_PATH,
              method: "POST",
              status: 429,
              provider: "password",
              result: "blocked",
              reasonCode,
              rateLimitSource: "otp_issue",
              maskedEmail,
              maskedIp,
            });

            // account state 확인 이후 Local RL은 purpose와 관계없이
            // 내부 reason만 기록하고 외부에는 success-like redirect로 숨긴다.
          } else {
            try {
              // 허용 직후 다른 await/I/O 없이 Provider operation을 시작한다.
              const issueResult = await issueOtpAndSendEmailWithResult(
                otpIssueInput,
                otpIssueClient,
              );

              if (issueResult.ok) {
                otpIssueRateLimit.recordSuccessfulIssue({
                  purpose,
                  canonicalEmail,
                });

                logAuthEvent(AUTH_EVENTS.AUTH_RESEND_EMAIL_COMPLETED, {
                  path: RESEND_EMAIL_PATH,
                  method: "POST",
                  status: 200,
                  provider: "password",
                  result: "success",
                  maskedEmail,
                  maskedIp,
                });
              } else {
                logResendOtpIssueFailure(
                  issueResult.kind,
                  issueResult.diagnostic,
                  maskedEmail,
                  maskedIp,
                );

                // account state 확인 이후 Provider / Email failure는
                // 내부 reason만 구분하고 외부에는 success-like redirect로 숨긴다.
              }
            } finally {
              // in-flight를 실제로 획득한 경우에만 release한다.
              otpIssueRateLimit.releaseIssue({
                purpose,
                canonicalEmail,
              });
            }
          }
        } catch (error) {
          const normalized = normalizeUnknownError(error);
          logAuthError(AUTH_EVENTS.AUTH_RESEND_EMAIL_FAILED, {
            path: RESEND_EMAIL_PATH,
            method: "POST",
            status: 500,
            provider: "password",
            result: "failure",
            reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
            maskedEmail,
            maskedIp,
            ...normalized,
          });

          // account state 확인 이후 client / agreement 등 내부 예외도
          // 외부에는 success-like redirect로 숨긴다.
        }
      }
    }
  } catch (error) {
    const normalizedError =
      error instanceof GetUserByEmailError ? error.cause : error;
    const normalized = normalizeUnknownError(normalizedError);
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
    await applyMinimumActionDelay(start);
  }

  // account state 확인 이후 실패/차단과 정상 성공은 모두 verify-otp로 이동한다.
  redirect(verifyOtpUrl!);
}
