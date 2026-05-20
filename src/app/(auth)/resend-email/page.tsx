import { Metadata } from "next";
import { redirect } from "next/navigation";

import AuthEmailForm from "@/features/auth/components/AuthEmailForm";
import { resendEmailAction } from "@/features/auth/resend-email/actions/resendEmailAction";
import { INITIAL_RESEND_EMAIL_ACTION_STATE } from "@/features/auth/resend-email/actions/resendEmailActionState";
import { requireGuestPage } from "@/features/auth/utils/requireGuestPage";
import { ROUTES } from "@/lib/constants/routes";
import { otpPurposeSchema } from "@/lib/validation/otpPurposeSchema";

/**
 * 검색 엔진 인덱싱 방지
 *
 * OTP 재전송 페이지는 인증 보조 페이지이므로
 * 검색 엔진 노출 대상이 아니다.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * resend-email 페이지 query parameter
 */
type ResendEmailPageProps = {
  searchParams: Promise<{
    email?: string | string[];
    purpose?: string | string[];
    redirect?: string | string[];
  }>;
};

/**
 * OTP 인증 번호 재발송 페이지
 *
 * 역할:
 * - query parameter 검증
 * - 인증 흐름 목적(purpose) 복구
 * - 이메일 prefill 처리
 * - 재전송 action 연결
 * - Form 초기 상태 전달
 */
export const ResendEmailPage = async ({
  searchParams,
}: ResendEmailPageProps) => {
  /**
   * 이미 로그인된 사용자는
   * OTP 재발급 흐름에 접근할 수 없다.
   */
  await requireGuestPage();

  const {
    email: rawEmail,
    purpose: rawPurpose,
    redirect: rawRedirect,
  } = await searchParams;

  /**
   * query string 중복 전달 방어
   *
   * search parameter는 중복 전달 시 배열이 될 수 있다.
   * 의도하지 않은 입력은 무시하고
   * 단일 문자열만 정상 query로 인정한다.
   */
  const email = typeof rawEmail === "string" ? rawEmail : undefined;
  const purpose = typeof rawPurpose === "string" ? rawPurpose : undefined;
  const redirectPath = typeof rawRedirect === "string" ? rawRedirect : null;

  /**
   * purpose는 OTP 인증 흐름을 복구하기 위한 필수 값이다.
   *
   * signup / reset-password 외 값은 허용하지 않는다.
   * 유효하지 않으면 흐름 복구가 불가능하므로
   * 로그인 페이지로 이동한다.
   */
  const parsedOtpPurpose = otpPurposeSchema.safeParse(purpose);

  if (!parsedOtpPurpose.success) {
    redirect(ROUTES.LOGIN);
  }

  const otpPurpose = parsedOtpPurpose.data;

  /**
   * redirect 정보를 action에 고정한다.
   *
   * Form은 redirect 존재 여부를 알 필요가 없으므로
   * page 계층에서 action에 미리 연결한다.
   */
  const resendEmailFormAction = resendEmailAction.bind(null, redirectPath);

  return (
    <div className="md:flex md:min-h-[calc(100dvh-4.5rem)] md:items-center md:justify-center">
      <AuthEmailForm
        action={resendEmailFormAction}
        initialState={INITIAL_RESEND_EMAIL_ACTION_STATE}
        email={email}
        purpose={otpPurpose}
      />
    </div>
  );
};

export default ResendEmailPage;
