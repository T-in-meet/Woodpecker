import { resetPasswordAction } from "@/features/auth/reset-password/actions/resetPasswordAction";
import { ResetPasswordForm } from "@/features/auth/reset-password/components/ResetPasswordForm";

/**
 * reset-password 페이지 (Server Component)
 *
 * 역할:
 * - 비밀번호 재설정 Form 렌더링
 * - Server Action을 Form이 사용할 수 있는 형태로 바인딩
 *
 * 접근 제어:
 * - /reset-password 접근 가능 여부는 middleware에서 session 기준으로 판단한다
 * - page에서는 session을 직접 조회하지 않는다
 *
 * redirect:
 * - 최종 이동 경로는 Server Action에서 처리한다
 * - 이 페이지에서는 redirect를 결정하지 않는다
 */
export default function ResetPasswordPage() {
  /**
   * ResetPasswordForm에 전달할 Server Action
   *
   * resetPasswordAction은 redirectPath를 첫 번째 인자로 받는다.
   * 이 페이지에서는 redirectPath를 결정하지 않으므로 null로 고정한다.
   *
   * 실제 redirect는 action 내부에서 처리된다.
   */
  const resetPasswordFormAction = resetPasswordAction.bind(null, null);

  return (
    <main className="md:flex md:min-h-[calc(100dvh-4.5rem)] md:items-center md:justify-center">
      <ResetPasswordForm action={resetPasswordFormAction} />
    </main>
  );
}
