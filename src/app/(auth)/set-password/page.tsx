import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { SET_PASSWORD_INTENT_CLEANUP_PATH } from "@/features/auth/constants/routes";
import {
  logAuthError,
  normalizeUnknownError,
} from "@/features/auth/lib/authLogger";
import { getHasPasswordLogin } from "@/features/auth/lib/getHasPasswordLogin";
import {
  readSetPasswordIntent,
  verifySetPasswordIntent,
} from "@/features/auth/lib/setPasswordIntent";
import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { setPasswordAction } from "@/features/auth/set-password/actions/setPasswordAction";
import { SetPasswordForm } from "@/features/auth/set-password/components/SetPasswordForm";
import { ROUTES } from "@/lib/constants/routes";
import { getUser } from "@/lib/supabase/getUser";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

/**
 * signup OTP 인증 이후 비밀번호 로그인 상태와 signed Intent를 확인하는 페이지입니다.
 *
 * 역할:
 * - 현재 인증된 사용자 확인
 * - 실제 비밀번호 존재 여부 확인
 * - Set Password Intent를 확인해 obsolete/invalid credential 정리
 * - 실제 비밀번호가 없고 유효한 Intent가 있을 때만 설정 폼 제공
 *
 * redirect는 외부 입력이므로 이 페이지에서도 다시 검증합니다.
 */
export default async function SetPasswordPage({ searchParams }: Props) {
  const user = await getUser();

  if (!user) {
    redirect(ROUTES.SIGNUP);
  }

  const { redirect: redirectQuery } = await searchParams;
  const redirectPath = redirectQuery
    ? validateRedirectPath(redirectQuery)
    : null;

  let hasPasswordLogin: boolean;

  try {
    hasPasswordLogin = await getHasPasswordLogin(user.id);
  } catch (error) {
    const normalized = normalizeUnknownError(error);

    logAuthError(AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED, {
      path: ROUTES.SET_PASSWORD,
      method: "GET",
      status: 500,
      provider: "password",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      userId: user.id,
      ...normalized,
    });

    throw error;
  }

  /**
   * 실제 비밀번호 로그인 상태를 확인한 뒤 Set Password Intent를 한 번 읽습니다.
   *
   * 이미 Password Login이 가능한 경우 Set Password capability는 소멸한 상태입니다.
   * cookie가 남아 있으면 verifier 없이 cleanup하고, 없으면 MYPAGE로 수렴합니다.
   *
   * Password Login이 없는 경우에만 signed Intent를 현재 사용자에 바인딩해
   * 검증하며 valid Intent일 때만 설정 폼을 제공합니다.
   */
  const setPasswordIntent = await readSetPasswordIntent();

  if (hasPasswordLogin) {
    if (setPasswordIntent === null) {
      redirect(ROUTES.MYPAGE);
    }

    redirect(SET_PASSWORD_INTENT_CLEANUP_PATH);
  }

  if (setPasswordIntent === null) {
    redirect(ROUTES.MYPAGE);
  }

  const verifiedSetPasswordIntent = verifySetPasswordIntent({
    token: setPasswordIntent,
    expectedUserId: user.id,
  });

  if (!verifiedSetPasswordIntent) {
    redirect(SET_PASSWORD_INTENT_CLEANUP_PATH);
  }

  const setPasswordFormAction = setPasswordAction.bind(null, redirectPath);

  return (
    <Suspense fallback={null}>
      <SetPasswordForm action={setPasswordFormAction} />
    </Suspense>
  );
}
