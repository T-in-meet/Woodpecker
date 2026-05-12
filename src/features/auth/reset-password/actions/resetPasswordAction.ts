"use server";

import { redirect } from "next/navigation";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
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

function isSamePasswordError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "code" in error &&
    error.status === 422 &&
    error.code === "same_password"
  );
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
      status: "internal_error",
    };
  }

  if (!session) {
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
      status: "internal_error",
    };
  }

  if (updateError) {
    const isSamePassword = isSamePasswordError(updateError);

    logAuthError(AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED, {
      path: ROUTES.RESET_PASSWORD,
      method: "POST",
      status: isSamePassword ? 422 : 500,
      provider: "password",
      result: "failure",
      reasonCode: isSamePassword
        ? AUTH_LOG_REASONS.SAME_PASSWORD
        : AUTH_LOG_REASONS.INTERNAL_ERROR,
    });

    /**
     * Supabase는 기존 비밀번호와 동일한 경우 updateUser를 422 same_password로 실패시킨다.
     *
     * 외부 상태는 reset-password 실패로 동일하게 처리하되,
     * UI에서 전용 안내 문구를 보여줄 수 있도록 same_password인 경우에만 reason을 함께 반환한다.
     */
    if (isSamePassword) {
      return {
        status: "internal_error",
        reason: "same_password",
      };
    }

    /**
     * 그 외 updateUser 실패는 내부 오류로만 처리한다.
     * provider 세부 오류는 사용자에게 노출하지 않는다.
     */
    return {
      status: "internal_error",
    };
  }

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
