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
import { getHasPasswordLogin } from "@/features/auth/lib/getHasPasswordLogin";
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
 * signup OTP 인증 이후 비밀번호가 없는 인증 사용자에게
 * 이메일/비밀번호 로그인을 추가하기 위한 비밀번호 설정 Action입니다.
 *
 * 페이지 진입 시 비밀번호 존재 여부를 이미 확인하지만,
 * 페이지 렌더링 이후 제출 시점까지 사용자 상태가 변경될 수 있으므로
 * Action에서도 현재 사용자와 실제 비밀번호 존재 여부를 다시 확인합니다.
 *
 * 비밀번호가 이미 존재하는 경우에는 updateUser를 실행하지 않고,
 * signup 흐름에서 전달받은 최종 redirect를 보존하여 이동합니다.
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

    if (userError) {
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

  /**
   * 비밀번호 설정은 인증된 사용자만 수행할 수 있습니다.
   *
   * 세션이 만료되었거나 유효한 이메일을 가진 사용자를 확인할 수 없으면
   * 비밀번호를 변경하지 않고 signup 흐름으로 돌려보냅니다.
   */
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
    /**
     * 페이지 진입 시점의 판정만 신뢰하지 않고 제출 시점에 다시 확인합니다.
     *
     * provider metadata가 아니라 auth.users의 실제 비밀번호 존재 여부를
     * service-role 전용 RPC를 통해 조회합니다.
     *
     * 이를 통해 페이지 렌더링과 폼 제출 사이에 다른 경로에서
     * 비밀번호가 설정된 경우에도 중복 updateUser를 방지합니다.
     */
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

  /**
   * 제출 시점에 이미 비밀번호가 존재한다면
   * 비밀번호를 다시 설정하지 않고 후속 목적지로 이동합니다.
   *
   * redirectPath가 있으면 signup 시작 시점의 목적지를 보존하고,
   * 없거나 유효하지 않으면 기존 기본 경로인 MYPAGE를 사용합니다.
   */
  if (hasPasswordLogin) {
    logAuthEvent(AUTH_EVENTS.AUTH_SET_PASSWORD_REJECTED, {
      path: ROUTES.SET_PASSWORD,
      method: "POST",
      status: 303,
      provider: "password",
      result: "rejected",
      reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
    });

    redirect(resolveRedirectPath(redirectPath));
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
