import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
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
 * - 이미 비밀번호가 있으면 최종 목적지로 이동
 * - 비밀번호가 없으면 signed Set Password Intent 검증
 * - 유효한 Intent가 있을 때만 설정 폼 제공
 *
 * redirect는 외부 입력이므로 이 페이지에서도 다시 검증합니다.
 */
export default async function SetPasswordPage({ searchParams }: Props) {
  const user = await getUser();

  if (!user) {
    redirect(ROUTES.SIGNUP);
  }

  /**
   * OTP 인증 이전 단계에서 검증된 값이라도
   * set-password 페이지를 직접 호출할 수 있으므로 다시 검증합니다.
   *
   * redirect가 없는 경우에는 null을 유지해
   * 기존 기본 목적지(MYPAGE) 정책을 그대로 사용합니다.
   */
  const { redirect: redirectQuery } = await searchParams;
  const redirectPath = redirectQuery
    ? validateRedirectPath(redirectQuery)
    : null;

  /**
   * 실제 비밀번호 로그인 가능 여부를 확인합니다.
   *
   * RPC 조회 실패는 비밀번호가 없는 상태(false)로 간주할 수 없으므로
   * 기존처럼 오류를 전파합니다.
   *
   * 다만 Server Component 단계의 조회 실패도 Auth 구조화 로그에서
   * 확인할 수 있도록 기록한 뒤 동일한 오류를 다시 throw합니다.
   */
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
   * 이미 실제 비밀번호 로그인이 가능한 사용자라면
   * 비밀번호 설정 폼을 보여주지 않습니다.
   *
   * Set Password 목적이 이미 소멸한 상태이므로
   * signed Intent를 추가로 검증하지 않고 기존 redirect 계약을 유지합니다.
   */
  if (hasPasswordLogin) {
    redirect(redirectPath ?? ROUTES.MYPAGE);
  }

  /**
   * 실제 비밀번호가 없는 사용자만 signed Set Password Intent를 검증합니다.
   *
   * cookie가 없거나 verifier가 거부한 credential은 fail-closed하고,
   * request의 redirectPath를 실패 목적지로 사용하지 않습니다.
   */
  const setPasswordIntent = await readSetPasswordIntent();

  if (setPasswordIntent === null) {
    redirect(ROUTES.MYPAGE);
  }

  const verifiedSetPasswordIntent = verifySetPasswordIntent({
    token: setPasswordIntent,
    expectedUserId: user.id,
  });

  if (!verifiedSetPasswordIntent) {
    redirect(ROUTES.MYPAGE);
  }

  /**
   * 실제 비밀번호가 없고 signed Intent까지 유효한 사용자에게만
   * 비밀번호 설정 폼을 표시합니다.
   *
   * 설정 완료 후에도 동일한 최종 목적지를 사용할 수 있도록
   * 검증된 redirectPath를 Server Action에 전달합니다.
   */
  const setPasswordFormAction = setPasswordAction.bind(null, redirectPath);

  return (
    <Suspense fallback={null}>
      <SetPasswordForm action={setPasswordFormAction} />
    </Suspense>
  );
}
