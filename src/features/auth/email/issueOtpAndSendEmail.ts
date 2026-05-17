import { issueOtp } from "../lib/issueOtp";
import { OtpPurpose } from "../types/otp";
import { sendOtpEmail } from "./sendOtpEmail";

type issueOtpAndSendEmailProps = {
  email: string;
  purpose: OtpPurpose;
};

/**
 * OTP 발급 및 이메일 발송 통합 함수
 *
 * 프로젝트의 OTP purpose(signup, reset-password)를 기반으로
 * Supabase OTP를 발급한 뒤,
 * 사용자에게 OTP 이메일을 발송한다.
 *
 * 역할:
 * - OTP 발급(issueOtp)
 * - OTP 발급 실패 처리
 * - email_otp 존재 여부 검증
 * - OTP 이메일 발송(sendOtpEmail)
 *
 * 주의:
 * - 실제 이메일 렌더링 및 provider 발송은 sendOtpEmail이 담당한다.
 * - 실제 OTP 발급(generateLink)은 issueOtp가 담당한다.
 */
export async function issueOtpAndSendEmail({
  email,
  purpose,
}: issueOtpAndSendEmailProps) {
  /**
   * Supabase OTP를 발급한다.
   */
  const { otp, error } = await issueOtp({ email, purpose });

  /**
   * OTP 발급 과정에서 에러가 발생한 경우
   * 상위 계층(route/action)으로 에러를 전달한다.
   */
  if (error) {
    throw new Error(error.message);
  }

  /**
   * generateLink 결과에 email_otp가 존재하지 않으면
   * 정상적인 OTP 발급으로 간주하지 않는다.
   */
  if (!otp?.email_otp) {
    throw new Error("인증 번호를 받지 못했습니다.");
  }

  /**
   * 발급된 OTP를 기반으로 인증 이메일을 발송한다.
   */
  await sendOtpEmail({
    email,
    purpose,
    otp: otp.email_otp,
  });
}
