"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { RESET_REQUIRED_COOKIE_NAME } from "@/features/auth/constants/cookies";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
  normalizeUnknownError,
} from "@/features/auth/lib/authLogger";
import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { resetPasswordActionSchema } from "@/features/auth/reset-password/schemas/resetPasswordActionSchema";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

export type ResetPasswordActionState =
  | {
      status: "idle";
    }
  | {
      status: "field_error";
      fieldErrors: {
        password?: string[];
        confirmPassword?: string[];
      };
    }
  | {
      status: "global_error";
      message: string;
    };

export const initialResetPasswordActionState: ResetPasswordActionState = {
  status: "idle",
};

export const RESET_PASSWORD_GLOBAL_ERROR_MESSAGE =
  "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.";

function toPayload(formData: FormData): Record<string, FormDataEntryValue> {
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
      result: "invalid_input",
      reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
    });
    return {
      status: "field_error",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const cookieStore = await cookies();
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let session: Awaited<
    ReturnType<(typeof supabase)["auth"]["getSession"]>
  >["data"]["session"];

  try {
    supabase = await createClient();
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    session = currentSession;
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
      status: "global_error",
      message: RESET_PASSWORD_GLOBAL_ERROR_MESSAGE,
    };
  }

  const hasResetRequiredCookie = Boolean(
    cookieStore.get(RESET_REQUIRED_COOKIE_NAME),
  );

  if (!session || !hasResetRequiredCookie) {
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

  let updateError: unknown = null;
  try {
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    updateError = error;
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
      status: "global_error",
      message: RESET_PASSWORD_GLOBAL_ERROR_MESSAGE,
    };
  }

  if (updateError) {
    logAuthError(AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED, {
      path: ROUTES.RESET_PASSWORD,
      method: "POST",
      status: 500,
      provider: "password",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
    });
    return {
      status: "global_error",
      message: RESET_PASSWORD_GLOBAL_ERROR_MESSAGE,
    };
  }

  cookieStore.delete(RESET_REQUIRED_COOKIE_NAME);
  const finalRedirectPath = resolveRedirectPath(redirectPath);

  logAuthEvent(AUTH_EVENTS.AUTH_RESET_PASSWORD_COMPLETED, {
    path: ROUTES.RESET_PASSWORD,
    method: "POST",
    status: 303,
    provider: "password",
    result: "success",
  });

  redirect(finalRedirectPath);
}
