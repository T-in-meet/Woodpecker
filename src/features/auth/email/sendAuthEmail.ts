import { render } from "@react-email/render";
import React from "react";

import { AuthEmailTemplate } from "./AuthEmailTemplate";
import type { EmailProvider } from "./providers/emailProvider.types";
import { sendViaNodemailer } from "./providers/sendViaNodemailer";
import { sendViaResend } from "./providers/sendViaResend";

/**
 * 인증 이메일 링크 타입
 *
 * 정책:
 * - magiclink: 이메일 인증/로그인 링크
 * - recovery: 비밀번호 재설정 링크
 */
export type AuthEmailType = "magiclink" | "recovery";

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
  tokenHash: string,
  type: AuthEmailType,
  redirectPath: string | null = null,
): Promise<void> {
  const appUrl = process.env["APP_URL"];

  if (!appUrl) {
    throw new Error("APP_URL is not set");
  }

  // Supabase 표준 파라미터(token_hash, type)를 사용해 callback 링크를 구성한다.
  // redirectPath가 있으면 비밀번호 재설정 이후 이동할 경로를 callback까지 보존한다.
  const url = new URL("/api/auth/callback", appUrl);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);

  if (redirectPath) {
    url.searchParams.set("redirect", redirectPath);
  }

  const html = await render(
    React.createElement(AuthEmailTemplate, { link: url.toString() }),
  );

  const subject = type === "recovery" ? "비밀번호 재설정" : "이메일 인증";

  const provider = resolveEmailProvider();
  const payload = {
    from: resolveFromAddress(),
    to: email,
    subject: subject,
    html,
  };

  if (provider === "nodemailer") {
    await sendViaNodemailer(payload);
    return;
  }

  await sendViaResend(payload);
}
