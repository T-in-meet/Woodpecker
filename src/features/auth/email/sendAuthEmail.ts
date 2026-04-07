import { render } from "@react-email/render";
import React from "react";

import { resend } from "@/lib/resend";

import { AuthEmailTemplate } from "./AuthEmailTemplate";

type AuthEmailType = "verify-email";

export async function sendAuthEmail(
  email: string,
  ticket: string,
  type: AuthEmailType,
): Promise<void> {
  const appUrl = process.env["APP_URL"];

  if (!appUrl) {
    throw new Error("APP_URL is not set");
  }
  const link = `${appUrl}/auth/callback?ticket=${ticket}`;

  const html = await render(React.createElement(AuthEmailTemplate, { link }));

  let subject: string;

  switch (type) {
    case "verify-email":
      subject = "이메일 인증";
      break;
  }

  const { error } = await resend.emails.send({
    from: "noreply@woodpecker.com",
    to: email,
    subject: subject ?? "이메일 인증",
    html,
  });

  if (error) {
    throw new Error(error.message);
  }
}
