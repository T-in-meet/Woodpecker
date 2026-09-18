"use server";

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getHasPasswordLogin } from "@/features/auth/lib/getHasPasswordLogin";
import { createSetPasswordIntent } from "@/features/auth/lib/setPasswordIntent";
import { requireCurrentLegalAcceptance } from "@/features/auth/utils/requireCurrentLegalAcceptance";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

const MYPAGE_PROFILE_PATH = `${ROUTES.MYPAGE}?section=profile`;

const SET_PASSWORD_FROM_MYPAGE_PATH = `${ROUTES.SET_PASSWORD}?redirect=${encodeURIComponent(MYPAGE_PROFILE_PATH)}`;

/**
 * MyPage에서 비밀번호 설정 흐름을 시작합니다.
 *
 * 페이지 렌더 이후 세션·계정 상태가 바뀔 수 있으므로
 * Action 실행 시점의 서버 상태를 다시 확인한 뒤 signed Intent를 발급합니다.
 */
export async function startSetPasswordFromMypageAction(): Promise<never> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    if (isAuthSessionMissingError(userError)) {
      redirect(ROUTES.LOGIN);
    }

    throw userError;
  }

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  if (!user.email_confirmed_at) {
    const query = new URLSearchParams({ purpose: "signup" });

    if (user.email) {
      query.set("email", user.email);
    }

    redirect(`${ROUTES.RESEND_EMAIL}?${query.toString()}`);
  }

  await requireCurrentLegalAcceptance(user.id, MYPAGE_PROFILE_PATH);

  const hasPasswordLogin = await getHasPasswordLogin(user.id);

  if (hasPasswordLogin) {
    redirect(MYPAGE_PROFILE_PATH);
  }

  await createSetPasswordIntent({ userId: user.id });

  redirect(SET_PASSWORD_FROM_MYPAGE_PATH);
}
