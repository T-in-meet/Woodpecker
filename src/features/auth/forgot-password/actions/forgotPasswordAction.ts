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
import { createClient } from "@/lib/supabase/server";
import { getServerActionClientIp } from "@/lib/utils/getServerActionClientIp";

export type ForgotPasswordActionState =
  | {
      status: "idle";
      fieldErrors: null;
    }
  | {
      status: "success";
      fieldErrors: null;
    }
  | {
      status: "global_error";
      fieldErrors: null;
    }
  | {
      status: "field_error";
      fieldErrors: {
        email?: string[];
      };
    };

function successState(): ForgotPasswordActionState {
  return {
    status: "success",
    fieldErrors: null,
  };
}

function globalErrorState(): ForgotPasswordActionState {
  return {
    status: "global_error",
    fieldErrors: null,
  };
}

function buildRedirectTo(redirectPath: string | null): string {
  const appUrl = process.env["APP_URL"];
  if (!appUrl) {
    throw new Error("APP_URL must be set");
  }
  const url = new URL(AUTH_CALLBACK_PATH, appUrl);
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
        status: "field_error",
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
      logAuthEvent(AUTH_EVENTS.AUTH_FORGOT_PASSWORD_RATE_LIMITED, {
        path: FORGOT_PASSWORD_PATH,
        method: "POST",
        status: 429,
        provider: "password",
        result: "blocked",
        reasonCode: mapBlockedByToReason(eligibility.blockedBy),
        maskedEmail,
        maskedIp,
      });
      return successState();
    }

    const redirectTo = buildRedirectTo(redirectPath);
    const supabase = await createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo },
    );

    if (error) {
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
      return successState();
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
    return successState();
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
    return globalErrorState();
  } finally {
    await applyMinimumActionDelay(start);
  }
}
