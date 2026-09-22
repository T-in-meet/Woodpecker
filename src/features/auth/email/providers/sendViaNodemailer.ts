import { createRequire } from "node:module";

import type { EmailSendPayload } from "./emailProvider.types";

const requireFromEsm = createRequire(import.meta.url);

/**
 * SMTP 전송의 각 network phase/inactivity를 유한하게 제한한다.
 *
 * 이 값들은 sendMail() 전체를 하나의 절대 wall-clock timeout으로 제한하는 것이 아니다.
 * DNS 조회, 연결 수립, SMTP greeting, socket inactivity 각각에 개별 timeout을 적용해
 * 특정 network phase가 무기한 pending되는 것을 방지한다.
 */
const SMTP_CONNECTION_TIMEOUT_MS = 15 * 1000;
const SMTP_GREETING_TIMEOUT_MS = 10 * 1000;
const SMTP_DNS_TIMEOUT_MS = 10 * 1000;
const SMTP_SOCKET_TIMEOUT_MS = 15 * 1000;

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
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    dnsTimeout: SMTP_DNS_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
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
