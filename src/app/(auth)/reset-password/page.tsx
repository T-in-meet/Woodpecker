import type { Metadata } from "next";
import { Suspense } from "react";

import { resetPasswordAction } from "@/features/auth/reset-password/actions/resetPasswordAction";
import { ResetPasswordForm } from "@/features/auth/reset-password/components/ResetPasswordForm";
import { requireAuthUser } from "@/features/auth/utils/requireAuthUser";
import { ROUTES } from "@/lib/constants/routes";

// 검색 엔진 인덱싱 방지 (robots.txt Disallow보다 확실함 — 삭제 금지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Next.js 요구사항: searchParams는 Promise 형태
type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

/**
 * reset-password 페이지 (Server Component)
 *
 * 역할:
 * - 비밀번호 재설정 Form 렌더링
 * - Server Action을 Form이 사용할 수 있는 형태로 바인딩
 *
 * 접근 제어:
 * - /reset-password 접근 가능 여부는 page에서 getUser 기준으로 판단한다
 * - 비인증 접근 시 /forgot-password로 redirect한다
 *
 * redirect:
 * - 최종 이동은 Server Action에서 수행한다
 * - 이 페이지는 redirect query를 action으로 전달하는 역할만 한다
 *
 * * 주의:
 * Next.js App Router에서 searchParams는 Promise로 전달되므로
 * Props 타입도 Promise로 선언하고 await 후 사용해야 한다.
 *
 * 객체 타입으로 선언하면 PageProps 제약과 충돌하여 빌드 시
 * "Type '{ redirect?: string; }' is missing properties from type 'Promise'"
 * 오류가 발생한다.
 */
export default async function ResetPasswordPage({ searchParams }: Props) {
  // 인증되지 않은 사용자는 forgot-password로 redirect
  await requireAuthUser({ redirectTo: ROUTES.FORGOT_PASSWORD });

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
   * ResetPasswordForm에 전달할 Server Action
   *
   * - resetPasswordAction은 redirectPath를 첫 번째 인자로 받는다
   * - callback에서 전달된 redirect query를 action으로 전달하여
   *   reset-password 완료 후 원래 목적지로 이동할 수 있도록 한다
   *
   * - Form은 (prevState, formData) 시그니처를 기대하므로
   *   bind를 사용해 redirectPath를 미리 주입한다
   */
  const resetPasswordFormAction = resetPasswordAction.bind(null, redirectPath);

  return (
    <main className="md:flex md:min-h-[calc(100dvh-4.5rem)] md:items-center md:justify-center">
      <Suspense fallback={null}>
        <ResetPasswordForm action={resetPasswordFormAction} />
      </Suspense>
    </main>
  );
}
