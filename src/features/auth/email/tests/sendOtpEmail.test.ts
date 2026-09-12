import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OtpEmailTemplate } from "@/features/auth/email/OtpEmailTemplate";
import { sendViaNodemailer } from "@/features/auth/email/providers/sendViaNodemailer";
import { sendViaResend } from "@/features/auth/email/providers/sendViaResend";
import { resolveEmailProvider } from "@/features/auth/email/resolveEmailProvider";
import { resolveFromAddress } from "@/features/auth/email/resolveFromAddress";
import { sendOtpEmail } from "@/features/auth/email/sendOtpEmail";

vi.mock("@react-email/render", () => ({
  render: vi.fn(),
}));

vi.mock("@/features/auth/email/providers/sendViaNodemailer", () => ({
  sendViaNodemailer: vi.fn(),
}));

vi.mock("@/features/auth/email/providers/sendViaResend", () => ({
  sendViaResend: vi.fn(),
}));

vi.mock("@/features/auth/email/resolveEmailProvider", () => ({
  resolveEmailProvider: vi.fn(),
}));

vi.mock("@/features/auth/email/resolveFromAddress", () => ({
  resolveFromAddress: vi.fn(),
}));

describe("sendOtpEmail", () => {
  const email = "test@example.com";
  const otp = "123456";
  const from = "no-reply@example.com";
  const html = "<p>OTP Email</p>";

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(render).mockResolvedValue(html);
    vi.mocked(resolveFromAddress).mockReturnValue(from);
    vi.mocked(resolveEmailProvider).mockReturnValue("nodemailer");
    vi.mocked(sendViaNodemailer).mockResolvedValue(undefined);
    vi.mocked(sendViaResend).mockResolvedValue(undefined);
  });

  it("signup 목적이면 이메일 인증 번호 제목으로 발송한다.", async () => {
    await sendOtpEmail({ email, purpose: "signup", otp });

    expect(sendViaNodemailer).toHaveBeenCalledWith({
      from,
      to: email,
      subject: "딱다구리 이메일 인증 번호",
      html,
    });
  });

  it("reset-password 목적이면 비밀번호 재설정 인증 번호 제목으로 발송한다.", async () => {
    await sendOtpEmail({ email, purpose: "reset-password", otp });

    expect(sendViaNodemailer).toHaveBeenCalledWith({
      from,
      to: email,
      subject: "딱다구리 비밀번호 재설정 인증 번호",
      html,
    });
  });

  it("OTP 템플릿에 otp와 purpose를 전달한다.", async () => {
    await sendOtpEmail({ email, purpose: "signup", otp });

    expect(render).toHaveBeenCalledTimes(1);

    const renderCall = vi.mocked(render).mock.calls[0];

    expect(renderCall).toBeDefined();

    const element = renderCall![0] as ReactElement<{
      otp: string;
      purpose: string;
    }>;

    expect(element.type).toBe(OtpEmailTemplate);
    expect(element.props).toEqual({
      otp,
      purpose: "signup",
    });
  });

  it("provider가 nodemailer이면 sendViaNodemailer를 호출한다.", async () => {
    vi.mocked(resolveEmailProvider).mockReturnValue("nodemailer");

    await sendOtpEmail({ email, purpose: "signup", otp });

    expect(sendViaNodemailer).toHaveBeenCalledTimes(1);
    expect(sendViaResend).not.toHaveBeenCalled();
  });

  it("provider가 resend이면 sendViaResend를 호출한다.", async () => {
    vi.mocked(resolveEmailProvider).mockReturnValue("resend");

    await sendOtpEmail({ email, purpose: "signup", otp });

    expect(sendViaResend).toHaveBeenCalledTimes(1);
    expect(sendViaNodemailer).not.toHaveBeenCalled();
  });

  it("render 결과 HTML이 payload.html로 전달된다.", async () => {
    await sendOtpEmail({ email, purpose: "signup", otp });

    expect(sendViaNodemailer).toHaveBeenCalledWith(
      expect.objectContaining({
        html,
      }),
    );
  });

  it("발송 payload에 from, to, subject, html이 포함된다.", async () => {
    await sendOtpEmail({ email, purpose: "signup", otp });

    expect(sendViaNodemailer).toHaveBeenCalledWith({
      from,
      to: email,
      subject: "딱다구리 이메일 인증 번호",
      html,
    });
  });

  it("nodemailer 발송 실패 시 에러를 전파한다.", async () => {
    const error = new Error("nodemailer failed");
    vi.mocked(resolveEmailProvider).mockReturnValue("nodemailer");
    vi.mocked(sendViaNodemailer).mockRejectedValue(error);

    await expect(
      sendOtpEmail({ email, purpose: "signup", otp }),
    ).rejects.toThrow("nodemailer failed");
  });

  it("resend 발송 실패 시 에러를 전파한다.", async () => {
    const error = new Error("resend failed");
    vi.mocked(resolveEmailProvider).mockReturnValue("resend");
    vi.mocked(sendViaResend).mockRejectedValue(error);

    await expect(
      sendOtpEmail({ email, purpose: "signup", otp }),
    ).rejects.toThrow("resend failed");
  });
});
