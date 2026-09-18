"use server";

import { isAuthError, isAuthSessionMissingError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { RESET_PASSWORD_INTENT_CLEANUP_PATH } from "@/features/auth/constants/routes";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
  normalizeUnknownError,
} from "@/features/auth/lib/authLogger";
import { classifyPasswordUpdateError } from "@/features/auth/lib/classifyAuthProviderError";
import {
  clearSignedResetPasswordIntent,
  readSignedResetPasswordIntent,
  verifyResetPasswordIntent,
} from "@/features/auth/lib/signedResetPasswordIntent";
import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { resetPasswordActionSchema } from "@/features/auth/reset-password/schemas/resetPasswordActionSchema";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { ResetPasswordActionState } from "./resetPasswordActionState";

function toPayload(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function resolveRedirectPath(redirectPath: string | null): string {
  if (!redirectPath) {
    return ROUTES.MYPAGE;
  }

  return validateRedirectPath(redirectPath);
}

export async function resetPasswordAction(
  redirectPath: string | null,
  _prevState: ResetPasswordActionState,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  logRequested(AUTH_EVENTS.AUTH_RESET_PASSWORD_REQUESTED, {
    path: ROUTES.RESET_PASSWORD,
    method: "POST",
    provider: "password",
  });

  const payload = toPayload(formData);
  const parsed = resetPasswordActionSchema.safeParse(payload);

  if (!parsed.success) {
    logAuthEvent(AUTH_EVENTS.AUTH_RESET_PASSWORD_INVALID_INPUT, {
      path: ROUTES.RESET_PASSWORD,
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

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let user: Awaited<
    ReturnType<(typeof supabase)["auth"]["getUser"]>
  >["data"]["user"];

  try {
    supabase = await createClient();

    const {
      data: { user: currentUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError && !isAuthSessionMissingError(userError)) {
      throw userError;
    }

    user = currentUser;
  } catch (error) {
    const normalized = normalizeUnknownError(error);

    logAuthError(AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED, {
      path: ROUTES.RESET_PASSWORD,
      method: "POST",
      status: 500,
      provider: "password",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      ...normalized,
    });

    return {
      status: "internal_error",
    };
  }

  if (!user) {
    logAuthEvent(AUTH_EVENTS.AUTH_RESET_PASSWORD_REJECTED, {
      path: ROUTES.RESET_PASSWORD,
      method: "POST",
      status: 303,
      provider: "password",
      result: "rejected",
      reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
    });

    redirect(ROUTES.FORGOT_PASSWORD);
  }

  let resetPasswordIntent: string | null;

  try {
    resetPasswordIntent = await readSignedResetPasswordIntent();
  } catch (error) {
    const normalized = normalizeUnknownError(error);

    logAuthError(AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED, {
      path: ROUTES.RESET_PASSWORD,
      method: "POST",
      status: 500,
      provider: "password",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      ...normalized,
    });

    return {
      status: "internal_error",
    };
  }

  if (resetPasswordIntent === null) {
    logAuthEvent(AUTH_EVENTS.AUTH_RESET_PASSWORD_REJECTED, {
      path: ROUTES.RESET_PASSWORD,
      method: "POST",
      status: 303,
      provider: "password",
      result: "rejected",
      reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
    });

    redirect(ROUTES.FORGOT_PASSWORD);
  }

  let verifiedResetPasswordIntent;

  try {
    verifiedResetPasswordIntent = verifyResetPasswordIntent({
      token: resetPasswordIntent,
      expectedUserId: user.id,
    });
  } catch (error) {
    const normalized = normalizeUnknownError(error);

    logAuthError(AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED, {
      path: ROUTES.RESET_PASSWORD,
      method: "POST",
      status: 500,
      provider: "password",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      ...normalized,
    });

    return {
      status: "internal_error",
    };
  }

  if (!verifiedResetPasswordIntent) {
    logAuthEvent(AUTH_EVENTS.AUTH_RESET_PASSWORD_REJECTED, {
      path: ROUTES.RESET_PASSWORD,
      method: "POST",
      status: 303,
      provider: "password",
      result: "rejected",
      reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
    });

    redirect(RESET_PASSWORD_INTENT_CLEANUP_PATH);
  }

  const finalRedirectPath = resolveRedirectPath(redirectPath);
  let updateError = null;

  try {
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    updateError = error;
  } catch (error) {
    if (isAuthError(error)) {
      updateError = error;
    } else {
      const normalized = normalizeUnknownError(error);

      logAuthError(AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED, {
        path: ROUTES.RESET_PASSWORD,
        method: "POST",
        status: 500,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
        ...normalized,
      });

      return {
        status: "internal_error",
      };
    }
  }

  if (updateError) {
    const classification = classifyPasswordUpdateError(updateError);

    if (classification === "same_password") {
      logAuthError(AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED, {
        path: ROUTES.RESET_PASSWORD,
        method: "POST",
        status: 422,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.SAME_PASSWORD,
      });

      return {
        status: "internal_error",
        reason: "same_password",
      };
    }

    if (classification === "provider_rate_limit") {
      logAuthEvent(AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED, {
        path: ROUTES.RESET_PASSWORD,
        method: "POST",
        status: 429,
        provider: "password",
        result: "blocked",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
      });

      return {
        status: "blocked",
      };
    }

    const normalized = normalizeUnknownError(updateError);

    logAuthError(AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED, {
      path: ROUTES.RESET_PASSWORD,
      method: "POST",
      status: 500,
      provider: "password",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
      ...normalized,
    });

    return {
      status: "internal_error",
    };
  }

  let intentClearFailed = false;

  try {
    await clearSignedResetPasswordIntent();
  } catch (error) {
    const normalized = normalizeUnknownError(error);

    logAuthError(AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED, {
      path: ROUTES.RESET_PASSWORD,
      method: "POST",
      status: 303,
      provider: "password",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.PASSWORD_INTENT_CLEANUP_FAILED,
      ...normalized,
    });

    intentClearFailed = true;
  }

  if (intentClearFailed) {
    redirect(RESET_PASSWORD_INTENT_CLEANUP_PATH);
  }

  logAuthEvent(AUTH_EVENTS.AUTH_RESET_PASSWORD_COMPLETED, {
    path: ROUTES.RESET_PASSWORD,
    method: "POST",
    status: 303,
    provider: "password",
    result: "success",
  });

  redirect(finalRedirectPath);
}
