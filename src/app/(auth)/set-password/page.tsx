import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getHasPasswordLogin } from "@/features/auth/lib/getHasPasswordLogin";
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
 * signup OTP 인증 이후 비밀번호 로그인 상태를 확인하는 페이지입니다.
 *
 * 역할:
 * - 현재 인증된 사용자 확인
 * - 실제 비밀번호 존재 여부 확인
 * - 이미 비밀번호가 있으면 최종 목적지로 이동
 * - 비밀번호가 없으면 설정 폼 제공
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
   * 이미 실제 비밀번호 로그인이 가능한 사용자라면
   * 비밀번호 설정 폼을 보여주지 않습니다.
   *
   * signup 흐름에서 전달된 redirect가 있으면 해당 경로를 보존하고,
   * 없으면 기존 기본 경로인 MYPAGE로 이동합니다.
   */
  if (await getHasPasswordLogin(user.id)) {
    redirect(redirectPath ?? ROUTES.MYPAGE);
  }

  /**
   * 실제 비밀번호가 없는 사용자만 비밀번호 설정 폼을 표시합니다.
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
