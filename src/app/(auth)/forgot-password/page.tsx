import type { Metadata } from "next";

import AuthEmailForm from "@/features/auth/components/AuthEmailForm";
import { forgotPasswordAction } from "@/features/auth/forgot-password/actions/forgotPasswordAction";
import { INITIAL_FORGOT_PASSWORD_ACTION_STATE } from "@/features/auth/forgot-password/actions/forgotPasswordActionState";
import { requireGuestPage } from "@/features/auth/utils/requireGuestPage";

// 검색 엔진 인덱싱 방지 (robots.txt Disallow보다 확실함 — 삭제 금지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * forgot-password 페이지 query parameter
 */
type ForgotPasswordPageProps = {
  searchParams: Promise<{
    email?: string | string[];
    redirect?: string | string[];
  }>;
};

/**
 * Forgot Password 페이지
 *
 * 흐름:
 * forgot-password → verify-otp → reset-password → redirect
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
export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  /**
   * 로그인된 사용자는 접근 불가 (mypage로 redirect)
   */
  await requireGuestPage();

  const { email: rawEmail, redirect: rawRedirect } = await searchParams;

  /**
   * query string 중복 전달 방어
   *
   * search parameter는 중복 전달 시 배열이 될 수 있다.
   * 의도하지 않은 입력은 무시하고
   * 단일 문자열만 정상 query로 인정한다.
   */
  const email = typeof rawEmail === "string" ? rawEmail : undefined;
  const redirectPath =
    typeof rawRedirect === "string" &&
    rawRedirect !== "null" &&
    rawRedirect !== "undefined"
      ? rawRedirect
      : null;

  /**
   * ForgotPasswordForm에 전달할 Server Action
   *
   * - forgotPasswordAction은 (redirectPath, prevState, formData) 형태를 요구한다
   * - searchParams.redirect를 action의 redirectPath로 전달하여
   *   이후 verify-otp → reset-password → 최종 이동까지 redirect 흐름을 유지한다
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
      <AuthEmailForm
        action={forgotPasswordFormAction}
        initialState={INITIAL_FORGOT_PASSWORD_ACTION_STATE}
        email={email}
        purpose="reset-password"
      />
    </div>
  );
}
