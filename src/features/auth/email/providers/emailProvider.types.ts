// Provider 교체(nodemailer/resend) 시 호출부 계약을 고정하기 위한 공통 payload 타입.
export type EmailSendPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

export type EmailProvider = "resend" | "nodemailer";
