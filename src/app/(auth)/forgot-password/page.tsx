import type { Metadata } from "next";
import { Suspense } from "react";

import { forgotPasswordAction } from "@/features/auth/forgot-password/actions/forgotPasswordAction";
import { ForgotPasswordForm } from "@/features/auth/forgot-password/components/ForgotPasswordForm";

// 검색 엔진 인덱싱 방지 (robots.txt Disallow보다 확실함 — 삭제 금지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: { redirect?: string };
};

/**
 * Forgot Password 페이지
 *
 * 흐름:
 * forgot-password → callback → reset-password → redirect
 *
 * 이 페이지는 redirect query를 받아 이후 흐름 전체에 전달하는 시작점 역할을 한다.
 */
export default function ForgotPasswordPage({ searchParams }: Props) {
  /**
   * redirect query 전달
   *
   * - 이전 페이지(예: 보호된 페이지)에서 접근 시 redirect가 포함될 수 있다
   * - forgot-password → callback → reset-password → 최종 이동까지 이어지는 흐름을 유지하기 위해
   *   redirect 값을 action으로 전달한다
   *
   * - 없을 경우(null) fallback 경로로 처리된다
   */
  const redirect = searchParams?.redirect ?? null;

  /**
   * ForgotPasswordForm에 전달할 Server Action
   *
   * - forgotPasswordAction은 (redirectPath, prevState, formData) 형태를 요구한다
   * - searchParams.redirect를 action의 redirectPath로 전달하여
   *   이후 callback → reset-password → 최종 이동까지 redirect 흐름을 유지한다
   *
   * - Form은 (prevState, formData) 시그니처를 기대하므로
   *   bind로 redirectPath를 미리 주입한다
   */
  const forgotPasswordFormAction = forgotPasswordAction.bind(null, redirect);

  return (
    <div className="md:flex md:min-h-[calc(100dvh-4.5rem)] md:items-center md:justify-center">
      <Suspense fallback={null}>
        <ForgotPasswordForm action={forgotPasswordFormAction} />
      </Suspense>
    </div>
  );
}
