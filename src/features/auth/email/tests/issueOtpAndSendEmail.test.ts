import type { AuthError, GenerateLinkProperties } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MISSING_EMAIL_OTP_ERROR_MESSAGE } from "@/features/auth/constants/otp";
import { issueOtpAndSendEmail } from "@/features/auth/email/issueOtpAndSendEmail";
import { sendOtpEmail } from "@/features/auth/email/sendOtpEmail";
import { issueOtp } from "@/features/auth/lib/issueOtp";

vi.mock("@/features/auth/lib/issueOtp", () => ({
  issueOtp: vi.fn(),
}));

vi.mock("@/features/auth/email/sendOtpEmail", () => ({
  sendOtpEmail: vi.fn(),
}));

const createAuthError = (message: string) =>
  ({
    name: "AuthError",
    message,
    code: "otp_failed",
    status: 500,
  }) as unknown as AuthError;

const createOtpProperties = (emailOtp: string): GenerateLinkProperties => ({
  action_link: "https://example.com",
  email_otp: emailOtp,
  hashed_token: "hashed-token",
  redirect_to: "",
  verification_type: "magiclink",
});

describe("issueOtpAndSendEmail", () => {
  const email = "test@example.com";
  const purpose = "signup";
  const emailOtp = "123456";

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(issueOtp).mockResolvedValue({
      otp: createOtpProperties(emailOtp),
      error: null,
    });

    vi.mocked(sendOtpEmail).mockResolvedValue(undefined);
  });

  it("issueOtp 호출 시 email과 purpose를 전달한다.", async () => {
    await issueOtpAndSendEmail({ email, purpose });

    expect(issueOtp).toHaveBeenCalledWith({
      email,
      purpose,
    });
  });

  it("OTP 발급에 성공하면 sendOtpEmail을 호출한다.", async () => {
    await issueOtpAndSendEmail({ email, purpose });

    expect(sendOtpEmail).toHaveBeenCalledTimes(1);
  });

  it("sendOtpEmail 호출 시 email, purpose, email_otp를 전달한다.", async () => {
    await issueOtpAndSendEmail({ email, purpose });

    expect(sendOtpEmail).toHaveBeenCalledWith({
      email,
      purpose,
      otp: emailOtp,
    });
  });

  it("issueOtp가 error를 반환하면 에러를 전파한다.", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: null,
      error: createAuthError("OTP issue failed"),
    });

    await expect(issueOtpAndSendEmail({ email, purpose })).rejects.toThrow(
      "OTP issue failed",
    );
  });

  it("email_otp가 없으면 sendOtpEmail을 호출하지 않는다.", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: createOtpProperties(""),
      error: null,
    });

    await expect(issueOtpAndSendEmail({ email, purpose })).rejects.toThrow(
      MISSING_EMAIL_OTP_ERROR_MESSAGE,
    );

    expect(sendOtpEmail).not.toHaveBeenCalled();
  });

  it("sendOtpEmail이 실패하면 에러를 전파한다.", async () => {
    vi.mocked(sendOtpEmail).mockRejectedValue(new Error("send failed"));

    await expect(issueOtpAndSendEmail({ email, purpose })).rejects.toThrow(
      "send failed",
    );
  });

  it("otp가 null이면 에러를 던지고 sendOtpEmail을 호출하지 않는다.", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: null,
      error: null,
    });

    await expect(issueOtpAndSendEmail({ email, purpose })).rejects.toThrow(
      MISSING_EMAIL_OTP_ERROR_MESSAGE,
    );

    expect(sendOtpEmail).not.toHaveBeenCalled();
  });
});
