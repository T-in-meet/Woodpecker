"use server";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import {
  AUTH_CALLBACK_PATH,
  FORGOT_PASSWORD_PATH,
} from "@/features/auth/constants/routes";
import { forgotPasswordActionSchema } from "@/features/auth/forgot-password/schemas/forgotPasswordActionSchema";
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
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerActionClientIp } from "@/lib/utils/getServerActionClientIp";

import { sendAuthEmail } from "../../email/sendAuthEmail";
import { ForgotPasswordActionState } from "./forgotPasswordActionState";

function completedState(): ForgotPasswordActionState {
  return {
    status: "completed",
    fieldErrors: null,
  };
}

function blockedState(
  reasonCode:
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG,
): ForgotPasswordActionState {
  return {
    status: "blocked",
    reasonCode,
    fieldErrors: null,
  };
}

function internalErrorState(): ForgotPasswordActionState {
  return {
    status: "internal_error",
    reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
    fieldErrors: null,
  };
}

function buildRedirectTo(redirectPath: string | null): string {
  const appUrl = process.env["APP_URL"];
  if (!appUrl) {
    throw new Error("APP_URL must be set");
  }
  const url = new URL(AUTH_CALLBACK_PATH, appUrl);
  url.searchParams.set("type", "recovery");
  if (redirectPath) {
    url.searchParams.set("redirect", redirectPath);
  }
  return url.toString();
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
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const canonicalEmail = canonicalizeEmail(parsed.data.email);
    const clientIp = await getServerActionClientIp();
    const maskedEmail = maskEmailForLogging(canonicalEmail);
    const maskedIp = maskIpForLogging(clientIp);

    const eligibility = checkRequestEligibility(
      "forgot-password",
      clientIp,
      canonicalEmail,
    );

    if (!eligibility.allowed) {
      const reasonCode = mapBlockedByToReason(eligibility.blockedBy);

      logAuthEvent(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_RATE_LIMITED, {
        path: FORGOT_PASSWORD_PATH,
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

    const redirectTo = buildRedirectTo(redirectPath);
    const adminClient = createAdminClient();
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: parsed.data.email,
        options: { redirectTo },
      });

    if (linkError) {
      logAuthError(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED, {
        path: FORGOT_PASSWORD_PATH,
        method: "POST",
        status: 500,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        maskedEmail,
        maskedIp,
      });
      return completedState();
    }

    const tokenHash = linkData?.properties?.hashed_token;

    if (!tokenHash) {
      throw new Error("Missing hashed_token from generateLink");
    }

    try {
      await sendAuthEmail(email, tokenHash, "recovery", redirectPath);
    } catch {
      logAuthError(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED, {
        path: FORGOT_PASSWORD_PATH,
        method: "POST",
        status: 500,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        maskedEmail,
        maskedIp,
      });
      return completedState();
    }

    logAuthEvent(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_COMPLETED, {
      path: FORGOT_PASSWORD_PATH,
      method: "POST",
      status: 200,
      provider: "password",
      result: "success",
      maskedEmail,
      maskedIp,
    });
    return completedState();
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
}
