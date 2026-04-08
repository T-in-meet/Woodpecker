import { resend } from "@/lib/resend";

import type { EmailSendPayload } from "./emailProvider.types";

// 운영 기본 provider인 Resend 전송을 분리해 sendAuthEmail의 분기 로직을 단순화한다.
export async function sendViaResend(payload: EmailSendPayload): Promise<void> {
  const { error } = await resend.emails.send(payload);

  if (error) {
    console.error("[sendViaResend] Resend error:", error);
    throw new Error(error.message);
  }
}
