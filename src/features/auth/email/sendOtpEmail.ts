import { render } from "@react-email/render";
import React from "react";

import {
  OTP_EMAIL_DELIVERY_TIMEOUT_MS,
  type OtpPurpose,
} from "@/features/auth/constants/otp";
import { OtpEmailTemplate } from "@/features/auth/email/OtpEmailTemplate";
import { sendViaNodemailer } from "@/features/auth/email/providers/sendViaNodemailer";
import { sendViaResend } from "@/features/auth/email/providers/sendViaResend";
import { resolveEmailProvider } from "@/features/auth/email/resolveEmailProvider";
import { resolveFromAddress } from "@/features/auth/email/resolveFromAddress";

type SendOtpEmailProps = {
  email: string;
  purpose: OtpPurpose;
  otp: string;
};

class OtpEmailDeliveryTimeoutError extends Error {
  constructor() {
    super("OTP email delivery timed out.");
    this.name = "OtpEmailDeliveryTimeoutError";
  }
}

/**
 * 실제 Email Provider 호출의 caller-side wall-clock wait를 제한한다.
 *
 * Provider SDK가 cancellation signal을 지원하지 않는 경우 timeout 이후에도
 * underlying remote operation이 늦게 완료될 수 있다. 이 helper의 목적은
 * remote cancellation이 아니라 Woodpecker caller의 bounded-settle 보장이다.
 */
async function waitForEmailDelivery(
  deliveryPromise: Promise<void>,
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new OtpEmailDeliveryTimeoutError());
    }, OTP_EMAIL_DELIVERY_TIMEOUT_MS);
  });

  try {
    await Promise.race([deliveryPromise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

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
 * - Provider delivery 전체 wait를 유한한 시간으로 제한
 *
 * 주의:
 * - OTP 발급(generateLink)은 담당하지 않는다.
 * - 실제 OTP 발급은 issueOtp 계층에서 수행한다.
 * - delivery timeout은 caller wait만 종료하며 remote cancellation을 보장하지 않는다.
 */
export async function sendOtpEmail({ email, purpose, otp }: SendOtpEmailProps) {
  /**
   * React Email 템플릿을 HTML 문자열로 렌더링한다.
   *
   * 이메일 본문도 signup / reset-password 목적에 따라
   * 서로 다른 안내 문구를 사용하므로 purpose를 함께 전달한다.
   */
  const html = await render(
    React.createElement(OtpEmailTemplate, {
      otp,
      purpose,
    }),
  );

  /**
   * OTP 목적(signup / reset-password)에 따라
   * 이메일 제목을 구성한다.
   */
  const subject =
    purpose === "reset-password"
      ? "딱다구리 비밀번호 재설정 인증 번호"
      : "딱다구리 이메일 인증 번호";

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
   * 실제 Provider send Promise에만 공통 wall-clock deadline을 적용한다.
   * 템플릿 렌더링과 payload 준비 시간은 Email delivery timeout에 포함하지 않는다.
   */
  const deliveryPromise =
    provider === "nodemailer"
      ? sendViaNodemailer(payload)
      : sendViaResend(payload);

  await waitForEmailDelivery(deliveryPromise);
}
