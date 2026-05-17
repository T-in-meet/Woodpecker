import { render } from "@react-email/render";
import React from "react";

import { OtpPurpose } from "../types/otp";
import { OtpEmailTemplate } from "./OtpEmailTemplate";
import { sendViaNodemailer } from "./providers/sendViaNodemailer";
import { sendViaResend } from "./providers/sendViaResend";
import { resolveEmailProvider } from "./resolveEmailProvider";
import { resolveFromAddress } from "./resolveFromAddress";

type SendOtpEmailProps = {
  email: string;
  purpose: OtpPurpose;
  otp: string;
};

/**
 * OTP 이메일 발송 함수
 *
 * 전달받은 OTP 코드를 기반으로 이메일 HTML을 렌더링하고,
 * 현재 프로젝트의 이메일 provider 정책에 따라 실제 발송을 수행한다.
 *
 * 역할:
 * - OTP 이메일 템플릿 렌더링
 * - purpose 기반 이메일 제목 구성
 * - provider(nodemailer/resend) 분기 처리
 * - 이메일 발송 실행
 *
 * 주의:
 * - OTP 발급(generateLink)은 담당하지 않는다.
 * - 실제 OTP 발급은 issueOtp 계층에서 수행한다.
 */
export async function sendOtpEmail({ email, purpose, otp }: SendOtpEmailProps) {
  /**
   * React Email 템플릿을 HTML 문자열로 렌더링한다.
   */
  const html = await render(React.createElement(OtpEmailTemplate, { otp }));

  /**
   * OTP 목적(signup / reset-password)에 따라
   * 이메일 제목을 구성한다.
   */
  const subject =
    purpose === "reset-password" ? "비밀번호 재설정 인증 번호" : "인증 번호";

  /**
   * 현재 프로젝트 환경에 맞는 이메일 provider를 결정한다.
   */
  const provider = resolveEmailProvider();

  /**
   * 실제 이메일 발송에 사용할 payload를 구성한다.
   */
  const payload = {
    from: resolveFromAddress(),
    to: email,
    subject,
    html,
  };

  /**
   * nodemailer 사용 환경이면 SMTP 기반으로 발송한다.
   */
  if (provider === "nodemailer") {
    await sendViaNodemailer(payload);
    return;
  }

  /**
   * 그 외 환경에서는 Resend provider를 사용한다.
   */
  await sendViaResend(payload);
}
