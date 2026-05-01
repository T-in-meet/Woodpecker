import type { Metadata } from "next";
import { Suspense } from "react";

import { resetPasswordAction } from "@/features/auth/reset-password/actions/resetPasswordAction";
import { ResetPasswordForm } from "@/features/auth/reset-password/components/ResetPasswordForm";

// 검색 엔진 인덱싱 방지 (robots.txt Disallow보다 확실함 — 삭제 금지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: { redirect?: string };
};

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
 * - 최종 이동은 Server Action에서 수행한다
 * - 이 페이지는 redirect query를 action으로 전달하는 역할만 한다
 */
export default function ResetPasswordPage({ searchParams }: Props) {
  /**
   * redirect query 전달
   *
   * - callback에서 전달된 redirect 값을 받아
   *   reset-password 완료 후 최종 이동 경로로 사용한다
   *
   * - 값이 없으면 action 내부 fallback 경로를 사용한다
   */
  const redirect = searchParams?.redirect ?? null;

  /**
   * ResetPasswordForm에 전달할 Server Action
   *
   * - resetPasswordAction은 redirectPath를 첫 번째 인자로 받는다
   * - callback에서 전달된 redirect query를 action으로 전달하여
   *   reset-password 완료 후 원래 목적지로 이동할 수 있도록 한다
   *
   * - Form은 (prevState, formData) 시그니처를 기대하므로
   *   bind를 사용해 redirectPath를 미리 주입한다
   */
  const resetPasswordFormAction = resetPasswordAction.bind(null, redirect);

  return (
    <main className="md:flex md:min-h-[calc(100dvh-4.5rem)] md:items-center md:justify-center">
      <Suspense fallback={null}>
        <ResetPasswordForm action={resetPasswordFormAction} />
      </Suspense>
    </main>
  );
}
