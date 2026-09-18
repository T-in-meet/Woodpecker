"use server";

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { SET_PASSWORD_INTENT_CLEANUP_PATH } from "@/features/auth/constants/routes";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
  normalizeUnknownError,
} from "@/features/auth/lib/authLogger";
import { getHasPasswordLogin } from "@/features/auth/lib/getHasPasswordLogin";
import {
  clearSetPasswordIntent,
  readSetPasswordIntent,
  verifySetPasswordIntent,
} from "@/features/auth/lib/setPasswordIntent";
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
 *
 * redirectPath가 없으면 기본 경로인 MYPAGE를 사용하고,
 * 값이 있으면 validateRedirectPath를 통해 허용된 내부 경로인지
 * 다시 검증한 뒤 사용합니다.
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
 * signed Set Password Intent가 허용한 인증 사용자에게 비밀번호 로그인을 추가합니다.
 *
 * GET에서 이미 검증한 상태를 신뢰하지 않고 제출 시점에 current user,
 * Password Login 존재 여부, signed Intent와 user binding을 다시 확인한 뒤에만
 * updateUser를 호출합니다.
 *
 * Password Login이 이미 존재하면 Set Password 목적이 소멸한 상태로 보고
 * mutation을 수행하지 않으며, 남은 Intent는 cleanup 경계로 위임합니다.
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

  if (!user?.email) {
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

  let hasPasswordLogin: boolean;

  try {
    hasPasswordLogin = await getHasPasswordLogin(user.id);
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

  let setPasswordIntent: string | null;

  try {
    setPasswordIntent = await readSetPasswordIntent();
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

  if (hasPasswordLogin) {
    logAuthEvent(AUTH_EVENTS.AUTH_SET_PASSWORD_REJECTED, {
      path: ROUTES.SET_PASSWORD,
      method: "POST",
      status: 303,
      provider: "password",
      result: "rejected",
      reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
    });

    if (setPasswordIntent !== null) {
      redirect(SET_PASSWORD_INTENT_CLEANUP_PATH);
    }

    redirect(ROUTES.MYPAGE);
  }

  if (setPasswordIntent === null) {
    logAuthEvent(AUTH_EVENTS.AUTH_SET_PASSWORD_REJECTED, {
      path: ROUTES.SET_PASSWORD,
      method: "POST",
      status: 303,
      provider: "password",
      result: "rejected",
      reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
    });

    redirect(ROUTES.MYPAGE);
  }

  let verifiedSetPasswordIntent;

  try {
    verifiedSetPasswordIntent = verifySetPasswordIntent({
      token: setPasswordIntent,
      expectedUserId: user.id,
    });
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

  if (!verifiedSetPasswordIntent) {
    logAuthEvent(AUTH_EVENTS.AUTH_SET_PASSWORD_REJECTED, {
      path: ROUTES.SET_PASSWORD,
      method: "POST",
      status: 303,
      provider: "password",
      result: "rejected",
      reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
    });

    redirect(SET_PASSWORD_INTENT_CLEANUP_PATH);
  }

  const finalRedirectPath = resolveRedirectPath(redirectPath);
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

  let intentClearFailed = false;

  try {
    await clearSetPasswordIntent();
  } catch (error) {
    const normalized = normalizeUnknownError(error);

    logAuthError(AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED, {
      path: ROUTES.SET_PASSWORD,
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
    redirect(SET_PASSWORD_INTENT_CLEANUP_PATH);
  }

  logAuthEvent(AUTH_EVENTS.AUTH_SET_PASSWORD_COMPLETED, {
    path: ROUTES.SET_PASSWORD,
    method: "POST",
    status: 303,
    provider: "password",
    result: "success",
  });

  redirect(finalRedirectPath);
}
