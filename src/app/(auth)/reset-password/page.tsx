import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { RESET_REQUIRED_COOKIE_NAME } from "@/features/auth/constants/cookies";
import { resetPasswordAction } from "@/features/auth/reset-password/actions/resetPasswordAction";
import { ResetPasswordForm } from "@/features/auth/reset-password/components/ResetPasswordForm";
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

  /**
   * ResetPasswordForm에 전달할 Server Action
   *
   * - resetPasswordAction은 (redirectPath, prevState, formData) 형태를 요구한다
   * - reset-password 페이지에서는 redirect query를 사용하지 않으므로 null로 고정한다
   * - Form이 기대하는 시그니처 (prevState, formData)에 맞추기 위해 bind로 1차 인자를 미리 주입한다
   */
  const resetPasswordFormAction = resetPasswordAction.bind(null, null);

  return (
    <main className="md:flex md:min-h-[calc(100dvh-4.5rem)] md:items-center md:justify-center">
      <ResetPasswordForm action={resetPasswordFormAction} />
    </main>
  );
}
