import { Metadata } from "next";
import { redirect } from "next/navigation";

import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { requireGuestPage } from "@/features/auth/utils/requireGuestPage";
import { verifyOtpAction } from "@/features/auth/verify-otp/actions/verifyOtpAction";
import VerifyOtpForm from "@/features/auth/verify-otp/components/VerifyOtpForm";
import { ROUTES } from "@/lib/constants/routes";
import { otpPurposeSchema } from "@/lib/validation/otpPurposeSchema";

/**
 * 검색 엔진 인덱싱 방지
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type VerifyOtpPageProps = {
  searchParams: Promise<{
    email?: string | string[];
    purpose?: string | string[];
    redirect?: string | string[];
  }>;
};

/**
 * OTP 인증 입력 페이지
 */
const VerifyOtpPage = async ({ searchParams }: VerifyOtpPageProps) => {
  /**
   * 이미 로그인된 사용자는 OTP 인증 페이지에 접근할 수 없다.
   */
  await requireGuestPage();

  const {
    email: rawEmail,
    purpose: rawPurpose,
    redirect: rawRedirect,
  } = await searchParams;

  /**
   * 중복 query string은 배열로 들어올 수 있으므로
   * 단일 문자열인 경우만 정상 query로 사용한다.
   */
  const email = typeof rawEmail === "string" ? rawEmail : undefined;
  const purpose = typeof rawPurpose === "string" ? rawPurpose : undefined;

  /**
   * purpose는 인증 흐름을 결정하는 필수 값이다.
   * 유효하지 않으면 흐름 복구가 불가능하므로 로그인 페이지로 이동한다.
   */
  const parsedOtpPurpose = otpPurposeSchema.safeParse(purpose);

  if (!parsedOtpPurpose.success) {
    redirect(ROUTES.LOGIN);
  }

  const otpPurpose = parsedOtpPurpose.data;

  /**
   * redirect query 처리
   *
   * signup:
   * - verify-otp가 최종 이동 직전 단계다.
   * - 최종 이동에 사용될 값이므로 현재 단계에서 검증한다.
   *
   * reset-password:
   * - verify-otp는 중간 단계다.
   * - redirect는 reset-password 완료 이후 사용되므로
   *   현재 단계에서는 검증하지 않고 그대로 전달한다.
   *
   * 정책:
   * - signup → 검증된 redirect 사용
   * - reset-password → raw redirect 전달
   */
  const redirectPath =
    otpPurpose === "signup" &&
    typeof rawRedirect === "string" &&
    rawRedirect !== "null" &&
    rawRedirect !== "undefined"
      ? validateRedirectPath(rawRedirect)
      : typeof rawRedirect === "string" &&
          rawRedirect !== "null" &&
          rawRedirect !== "undefined"
        ? rawRedirect
        : null;

  /**
   * email이 없으면 OTP 검증을 진행할 수 없다.
   * 단, purpose는 유지할 수 있으므로 재전송 페이지에서 복구하도록 보낸다.
   */
  if (!email) {
    const params = new URLSearchParams({
      purpose: otpPurpose,
    });

    /**
     * reset-password 같은 후속 이동 목적지가 있으면
     * 재전송 흐름에서도 유실되지 않도록 함께 전달한다.
     */
    if (redirectPath) {
      params.set("redirect", redirectPath);
    }

    redirect(`${ROUTES.RESEND_EMAIL}?${params.toString()}`);
  }

  /**
   * redirect query는 인증 성공 이후 이동할 목적지로 action에 전달한다.
   */
  const verifyOtpFormAction = verifyOtpAction.bind(null, redirectPath);

  return (
    <div className="md:flex md:min-h-[calc(100dvh-4.5rem)] md:items-center md:justify-center">
      <VerifyOtpForm
        action={verifyOtpFormAction}
        email={email}
        purpose={otpPurpose}
        redirect={redirectPath}
      />
    </div>
  );
};

export default VerifyOtpPage;
