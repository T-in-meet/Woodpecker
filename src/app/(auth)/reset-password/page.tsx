import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { RESET_REQUIRED_COOKIE_NAME } from "@/features/auth/constants/cookies";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * reset-password 페이지 (Server Component)
 *
 * 역할:
 * - middleware 접근 제어의 2차 방어선
 * - 직접 접근 / middleware 우회 상황 방지
 *
 * 검증 조건:
 * - Supabase session 존재
 * - reset-required cookie 존재
 *
 * 실패 시:
 * - forgot-password로 redirect
 *
 * 주의:
 * - redirect query는 여기서 사용하지 않는다
 * - 최종 redirect 검증은 Server Action에서 수행한다
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();

  // 현재 사용자 session 조회
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // reset-required cookie 존재 여부 확인
  const cookieStore = await cookies();
  const resetRequiredCookie = cookieStore.get(RESET_REQUIRED_COOKIE_NAME);

  // 접근 조건 미충족 시 차단
  if (!session || !resetRequiredCookie) {
    redirect(ROUTES.FORGOT_PASSWORD);
  }

  return <main>Reset Password</main>;
}
