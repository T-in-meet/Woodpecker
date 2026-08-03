import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { hasPasswordLogin } from "@/features/auth/lib/authProviders";
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
 * OAuth 계정에 이메일/비밀번호 로그인을 추가하는 페이지입니다.
 */
export default async function SetPasswordPage({ searchParams }: Props) {
  const user = await getUser();

  if (!user) {
    redirect(ROUTES.SIGNUP);
  }

  if (hasPasswordLogin(user)) {
    redirect(ROUTES.MYPAGE);
  }

  const { redirect: redirectQuery } = await searchParams;
  const redirectPath = redirectQuery ?? null;
  const setPasswordFormAction = setPasswordAction.bind(null, redirectPath);

  return (
    <main className="md:flex md:min-h-[calc(100dvh-4.5rem)] md:items-center md:justify-center">
      <Suspense fallback={null}>
        <SetPasswordForm action={setPasswordFormAction} />
      </Suspense>
    </main>
  );
}
