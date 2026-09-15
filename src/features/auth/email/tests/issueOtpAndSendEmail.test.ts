import type { AuthError, GenerateLinkProperties } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MISSING_EMAIL_OTP_ERROR_MESSAGE } from "@/features/auth/constants/otp";
import {
  issueOtpAndSendEmail,
  issueOtpAndSendEmailWithResult,
} from "@/features/auth/email/issueOtpAndSendEmail";
import { sendOtpEmail } from "@/features/auth/email/sendOtpEmail";
import {
  createOtpIssueClient,
  issueOtp,
  type OtpIssueClient,
} from "@/features/auth/lib/issueOtp";

vi.mock("@/features/auth/lib/issueOtp", () => ({
  createOtpIssueClient: vi.fn(),
  issueOtp: vi.fn(),
}));

vi.mock("@/features/auth/email/sendOtpEmail", () => ({
  sendOtpEmail: vi.fn(),
}));

type AuthErrorFixture = {
  message: string;
  code?: string;
  status?: number;
};

const createAuthError = ({
  message,
  code = "otp_failed",
  status = 500,
}: AuthErrorFixture) =>
  ({
    name: "AuthError",
    message,
    code,
    status,
  }) as unknown as AuthError;

const createOtpProperties = (emailOtp: string): GenerateLinkProperties => ({
  action_link: "https://example.com",
  email_otp: emailOtp,
  hashed_token: "hashed-token",
  redirect_to: "",
  verification_type: "magiclink",
});

describe("issueOtpAndSendEmailWithResult", () => {
  const email = "test@example.com";
  const purpose = "signup";
  const emailOtp = "123456";
  const client = {} as OtpIssueClient;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(issueOtp).mockResolvedValue({
      otp: createOtpProperties(emailOtp),
      error: null,
    });

    vi.mocked(sendOtpEmail).mockResolvedValue(undefined);
  });

  it("OTP 발급과 이메일 전송이 성공하면 ok 결과를 반환한다.", async () => {
    const result = await issueOtpAndSendEmailWithResult(
      { email, purpose },
      client,
    );

    expect(result).toEqual({ ok: true });

    expect(issueOtp).toHaveBeenCalledWith({
      email,
      purpose,
      client,
    });

    expect(sendOtpEmail).toHaveBeenCalledWith({
      email,
      purpose,
      otp: emailOtp,
    });
  });

  it("Provider HTTP 429를 provider_rate_limit으로 분류한다.", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: null,
      error: createAuthError({
        message: "rate limited",
        code: "unknown_rate_limit_code",
        status: 429,
      }),
    });

    await expect(
      issueOtpAndSendEmailWithResult({ email, purpose }, client),
    ).resolves.toEqual({
      ok: false,
      kind: "provider_rate_limit",
      diagnostic: {
        errorMessage: "rate limited",
        errorName: "AuthError",
        errorCode: "unknown_rate_limit_code",
      },
    });

    expect(sendOtpEmail).not.toHaveBeenCalled();
  });

  it("Provider rate-limit code를 provider_rate_limit으로 분류한다.", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: null,
      error: createAuthError({
        message: "email rate limited",
        code: "over_email_send_rate_limit",
        status: 400,
      }),
    });

    await expect(
      issueOtpAndSendEmailWithResult({ email, purpose }, client),
    ).resolves.toEqual({
      ok: false,
      kind: "provider_rate_limit",
      diagnostic: {
        errorMessage: "email rate limited",
        errorName: "AuthError",
        errorCode: "over_email_send_rate_limit",
      },
    });

    expect(sendOtpEmail).not.toHaveBeenCalled();
  });

  it("일반 Provider 오류를 provider_error로 분류한다.", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: null,
      error: createAuthError({
        message: "provider failed",
        code: "unexpected_provider_error",
        status: 500,
      }),
    });

    await expect(
      issueOtpAndSendEmailWithResult({ email, purpose }, client),
    ).resolves.toEqual({
      ok: false,
      kind: "provider_error",
      diagnostic: {
        errorMessage: "provider failed",
        errorName: "AuthError",
        errorCode: "unexpected_provider_error",
      },
    });

    expect(sendOtpEmail).not.toHaveBeenCalled();
  });

  it("issueOtp 자체가 throw하면 provider_error로 fail-safe 처리한다.", async () => {
    vi.mocked(issueOtp).mockRejectedValue(new Error("provider timeout"));

    await expect(
      issueOtpAndSendEmailWithResult({ email, purpose }, client),
    ).resolves.toEqual({
      ok: false,
      kind: "provider_error",
      diagnostic: {
        errorMessage: "provider timeout",
        errorName: "Error",
      },
    });

    expect(sendOtpEmail).not.toHaveBeenCalled();
  });

  it("email_otp가 없으면 invalid_provider_response를 반환한다.", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: createOtpProperties(""),
      error: null,
    });

    await expect(
      issueOtpAndSendEmailWithResult({ email, purpose }, client),
    ).resolves.toEqual({
      ok: false,
      kind: "invalid_provider_response",
      diagnostic: {
        errorMessage: MISSING_EMAIL_OTP_ERROR_MESSAGE,
        errorName: "Error",
      },
    });

    expect(sendOtpEmail).not.toHaveBeenCalled();
  });

  it("otp가 null이면 invalid_provider_response를 반환한다.", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: null,
      error: null,
    });

    await expect(
      issueOtpAndSendEmailWithResult({ email, purpose }, client),
    ).resolves.toEqual({
      ok: false,
      kind: "invalid_provider_response",
      diagnostic: {
        errorMessage: MISSING_EMAIL_OTP_ERROR_MESSAGE,
        errorName: "Error",
      },
    });

    expect(sendOtpEmail).not.toHaveBeenCalled();
  });

  it("이메일 발송이 실패하면 delivery_error를 반환한다.", async () => {
    vi.mocked(sendOtpEmail).mockRejectedValue(new Error("send failed"));

    await expect(
      issueOtpAndSendEmailWithResult({ email, purpose }, client),
    ).resolves.toEqual({
      ok: false,
      kind: "delivery_error",
      diagnostic: {
        errorMessage: "send failed",
        errorName: "Error",
      },
    });
  });
});

describe("issueOtpAndSendEmail compatibility wrapper", () => {
  const email = "test@example.com";
  const purpose = "signup";
  const emailOtp = "123456";
  const client = {} as OtpIssueClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOtpIssueClient).mockReturnValue(client);

    vi.mocked(issueOtp).mockResolvedValue({
      otp: createOtpProperties(emailOtp),
      error: null,
    });

    vi.mocked(sendOtpEmail).mockResolvedValue(undefined);
  });

  it("성공 시 기존처럼 void로 완료한다.", async () => {
    await expect(
      issueOtpAndSendEmail({ email, purpose }),
    ).resolves.toBeUndefined();
  });

  it("Provider error의 기존 message 기반 throw 계약을 보존한다.", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: null,
      error: createAuthError({
        message: "OTP issue failed",
      }),
    });

    await expect(issueOtpAndSendEmail({ email, purpose })).rejects.toThrow(
      "OTP issue failed",
    );
  });

  it("issueOtp 자체의 thrown value를 그대로 전파한다.", async () => {
    const error = new Error("provider timeout");

    vi.mocked(issueOtp).mockRejectedValue(error);

    await expect(issueOtpAndSendEmail({ email, purpose })).rejects.toBe(error);
  });

  it("email_otp 누락 시 기존 에러 메시지를 보존한다.", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: null,
      error: null,
    });

    await expect(issueOtpAndSendEmail({ email, purpose })).rejects.toThrow(
      MISSING_EMAIL_OTP_ERROR_MESSAGE,
    );

    expect(sendOtpEmail).not.toHaveBeenCalled();
  });

  it("sendOtpEmail의 thrown value를 그대로 전파한다.", async () => {
    const error = new Error("send failed");

    vi.mocked(sendOtpEmail).mockRejectedValue(error);

    await expect(issueOtpAndSendEmail({ email, purpose })).rejects.toBe(error);
  });
});
