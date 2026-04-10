import { createRequire } from "node:module";

import type { EmailSendPayload } from "./emailProvider.types";

const requireFromEsm = createRequire(import.meta.url);

function getSmtpConfig() {
  const host = process.env["SMTP_HOST"];
  const portRaw = process.env["SMTP_PORT"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  // 개발 환경에서 nodemailer 사용 시 필요한 최소 SMTP 설정을 강제한다.
  if (!host || !portRaw || !user || !pass) {
    throw new Error(
      "SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS must be set for nodemailer",
    );
  }

  const port = Number(portRaw);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("SMTP_PORT is invalid");
  }

  return {
    host,
    port,
    // 465는 SMTPS(secure=true), 587은 STARTTLS(secure=false)로 동작한다.
    secure: port === 465,
    auth: { user, pass },
  };
}

// 개발 기본 provider인 nodemailer 전송을 분리해 provider 전환 시 영향 범위를 축소한다.
export async function sendViaNodemailer(
  payload: EmailSendPayload,
): Promise<void> {
  const nodemailer = requireFromEsm("nodemailer") as {
    createTransport: (config: unknown) => {
      sendMail: (mail: EmailSendPayload) => Promise<unknown>;
    };
  };

  const transporter = nodemailer.createTransport(getSmtpConfig());
  await transporter.sendMail(payload);
}
