import type { Metadata } from "next";
import { Suspense } from "react";

import { forgotPasswordAction } from "@/features/auth/forgot-password/actions/forgotPasswordAction";
import { ForgotPasswordForm } from "@/features/auth/forgot-password/components/ForgotPasswordForm";
import { requireGuestPage } from "@/features/auth/utils/requireGuestPage";

// 검색 엔진 인덱싱 방지 (robots.txt Disallow보다 확실함 — 삭제 금지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Next.js 요구사항: searchParams는 Promise 형태
type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

/**
 * Forgot Password 페이지
 *
 * 흐름:
 * forgot-password → callback → reset-password → redirect
 *
 * 이 페이지는 redirect query를 받아 이후 흐름 전체에 전달하는 시작점 역할을 한다.
 *
 * 주의:
 * Next.js App Router에서 searchParams는 Promise로 전달되므로
 * Props 타입도 Promise로 선언하고 await 후 사용해야 한다.
 *
 * 객체 타입으로 선언하면 PageProps 제약과 충돌하여 빌드 시
 * "Type '{ redirect?: string; }' is missing properties from type 'Promise'"
 * 오류가 발생한다.
 */
export default async function ForgotPasswordPage({ searchParams }: Props) {
  /**
   * 로그인된 사용자는 접근 불가 (mypage로 redirect)
   */
  await requireGuestPage();

  /**
   * redirect query 전달
   *
   * - callback에서 전달된 redirect 값을 받아
   *   reset-password 완료 후 최종 이동 경로로 사용한다
   *
   * - searchParams는 Next.js PageProps 기준 Promise이므로
   *   await 후 redirect 값을 추출한다
   *
   * - 값이 없으면 action 내부 fallback 경로를 사용한다
   */
  const { redirect } = await searchParams;

  const redirectPath = redirect ?? null;

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
  const forgotPasswordFormAction = forgotPasswordAction.bind(
    null,
    redirectPath,
  );

  return (
    <div className="md:flex md:min-h-[calc(100dvh-4.5rem)] md:items-center md:justify-center">
      <Suspense fallback={null}>
        <ForgotPasswordForm action={forgotPasswordFormAction} />
      </Suspense>
    </div>
  );
}
