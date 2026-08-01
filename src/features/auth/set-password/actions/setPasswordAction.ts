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

import { SetPasswordActionState } from "./setPasswordActionState";

/**
 * FormData를 schema 검증용 plain object로 변환합니다.
 */
function toPayload(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

/**
 * 최종 이동 경로를 안전한 내부 경로로 정규화합니다.
 */
function resolveRedirectPath(redirectPath: string | null): string {
  if (!redirectPath) {
    return ROUTES.MYPAGE;
  }

  return validateRedirectPath(redirectPath);
}

/**
 * Supabase same_password 오류인지 확인합니다.
 */
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

/**
 * OAuth 가입 후 이메일/비밀번호 로그인을 추가하기 위한 비밀번호 설정 Action입니다.
 */
export async function setPasswordAction(
  redirectPath: string | null,
  _prevState: SetPasswordActionState,
  formData: FormData,
): Promise<SetPasswordActionState> {
  logRequested(AUTH_EVENTS.AUTH_SET_PASSWORD_REQUESTED, {
    path: ROUTES.SET_PASSWORD,
    method: "POST",
    provider: "password",
  });

  const payload = toPayload(formData);
  const parsed = resetPasswordActionSchema.safeParse(payload);

  if (!parsed.success) {
    logAuthEvent(AUTH_EVENTS.AUTH_SET_PASSWORD_INVALID_INPUT, {
      path: ROUTES.SET_PASSWORD,
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
    logAuthError(AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED, {
      path: ROUTES.SET_PASSWORD,
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

  if (!session?.user?.email) {
    logAuthEvent(AUTH_EVENTS.AUTH_SET_PASSWORD_REJECTED, {
      path: ROUTES.SET_PASSWORD,
      method: "POST",
      status: 303,
      provider: "password",
      result: "rejected",
      reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
    });
    redirect(ROUTES.SIGNUP);
  }

  let updateError: unknown = null;
  try {
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    updateError = error;
  } catch (error) {
    const normalized = normalizeUnknownError(error);
    logAuthError(AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED, {
      path: ROUTES.SET_PASSWORD,
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

    logAuthError(AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED, {
      path: ROUTES.SET_PASSWORD,
      method: "POST",
      status: isSamePassword ? 422 : 500,
      provider: "password",
      result: "failure",
      reasonCode: isSamePassword
        ? AUTH_LOG_REASONS.SAME_PASSWORD
        : AUTH_LOG_REASONS.INTERNAL_ERROR,
    });

    if (isSamePassword) {
      return {
        status: "internal_error",
        reason: "same_password",
      };
    }

    return {
      status: "internal_error",
    };
  }

  logAuthEvent(AUTH_EVENTS.AUTH_SET_PASSWORD_COMPLETED, {
    path: ROUTES.SET_PASSWORD,
    method: "POST",
    status: 303,
    provider: "password",
    result: "success",
  });

  redirect(resolveRedirectPath(redirectPath));
}
