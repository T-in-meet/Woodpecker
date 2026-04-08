import { render } from "@react-email/render";
import React from "react";

import { AuthEmailTemplate } from "./AuthEmailTemplate";
import type { EmailProvider } from "./providers/emailProvider.types";
import { sendViaNodemailer } from "./providers/sendViaNodemailer";
import { sendViaResend } from "./providers/sendViaResend";

type AuthEmailType = "verify-email";

/**
 * 이메일 전송 provider를 환경에 따라 결정한다.
 *
 * - AUTH_EMAIL_PROVIDER가 있으면 강제 사용
 * - 없으면 production: resend, non-production: nodemailer
 */
function resolveEmailProvider(): EmailProvider {
  // TODO: Resend 도메인 검증 완료 시 아래 분기 로직을 다시 활성화한다.
  // const configured = process.env["AUTH_EMAIL_PROVIDER"];
  // if (configured === "nodemailer" || configured === "resend") {
  //   return configured;
  // }
  // return process.env.NODE_ENV === "production" ? "resend" : "nodemailer";

  // 현재 정책: 모든 환경에서 nodemailer 고정 사용.
  return "nodemailer";
}

/**
 * 발신자 주소를 환경변수에서 가져온다.
 *
 * provider가 바뀌어도 호출부는 동일 계약을 유지하기 위해
 * sendAuthEmail 단에서 단일 source-of-truth를 사용한다.
 */
function resolveFromAddress(): string {
  const from = process.env["AUTH_EMAIL_FROM"];

  if (!from) {
    throw new Error("AUTH_EMAIL_FROM is not set");
  }

  return from;
}

export async function sendAuthEmail(
  email: string,
  ticket: string,
  type: AuthEmailType,
): Promise<void> {
  const appUrl = process.env["APP_URL"];

  if (!appUrl) {
    throw new Error("APP_URL is not set");
  }

  // callback 경로를 API route로 고정해 클라이언트 페이지 미존재(404) 문제를 방지한다.
  const link = `${appUrl}/api/auth/callback?ticket=${ticket}`;
  const html = await render(React.createElement(AuthEmailTemplate, { link }));

  let subject: string;

  switch (type) {
    case "verify-email":
      subject = "이메일 인증";
      break;
  }

  const provider = resolveEmailProvider();
  const payload = {
    from: resolveFromAddress(),
    to: email,
    subject: subject ?? "이메일 인증",
    html,
  };

  if (provider === "nodemailer") {
    await sendViaNodemailer(payload);
    return;
  }

  await sendViaResend(payload);
}
