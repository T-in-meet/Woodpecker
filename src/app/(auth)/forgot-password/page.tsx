import type { Metadata } from "next";
import { Suspense } from "react";

import { forgotPasswordAction } from "@/features/auth/forgot-password/actions/forgotPasswordAction";
import { ForgotPasswordForm } from "@/features/auth/forgot-password/components/ForgotPasswordForm";

// 검색 엔진 인덱싱 방지 (robots.txt Disallow보다 확실함 — 삭제 금지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  /**
   * ForgotPasswordForm에 전달할 Server Action
   *
   * - forgotPasswordAction은 (redirectPath, prevState, formData) 형태를 요구한다
   * - 현재 forgot-password 페이지에서는 redirect query를 아직 사용하지 않으므로 null로 고정한다
   * - Form이 기대하는 시그니처 (prevState, formData)에 맞추기 위해 bind로 1차 인자를 미리 주입한다
   *
   * TODO:
   * - 이후 searchParams에서 redirect 값을 읽어 전달하도록 확장 필요
   */
  const forgotPasswordFormAction = forgotPasswordAction.bind(null, null);

  return (
    <div className="md:flex md:min-h-[calc(100dvh-4.5rem)] md:items-center md:justify-center">
      <Suspense fallback={null}>
        <ForgotPasswordForm action={forgotPasswordFormAction} />
      </Suspense>
    </div>
  );
}
