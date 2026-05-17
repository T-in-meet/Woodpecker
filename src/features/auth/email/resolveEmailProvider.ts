import { EmailProvider } from "./providers/emailProvider.types";

export function resolveEmailProvider(): EmailProvider {
  // TODO: Resend 도메인 검증 완료 시 아래 분기 로직을 다시 활성화한다.
  // const configured = process.env["AUTH_EMAIL_PROVIDER"];
  // if (configured === "nodemailer" || configured === "resend") {
  //   return configured;
  // }
  // return process.env.NODE_ENV === "production" ? "resend" : "nodemailer";

  // 현재 정책: 모든 환경에서 nodemailer 고정 사용.
  return "nodemailer";
}
