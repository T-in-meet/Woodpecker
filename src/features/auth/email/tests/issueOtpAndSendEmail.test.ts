import type { AuthError, GenerateLinkProperties } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MISSING_EMAIL_OTP_ERROR_MESSAGE,
  MISSING_SIGNUP_USER_ID_ERROR_MESSAGE,
} from "@/features/auth/constants/otp";
import { issueOtpAndSendEmailWithResult } from "@/features/auth/email/issueOtpAndSendEmail";
import { sendOtpEmail } from "@/features/auth/email/sendOtpEmail";
import { issueOtp, type OtpIssueClient } from "@/features/auth/lib/issueOtp";

vi.mock("@/features/auth/lib/issueOtp", () => ({
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
  const emailOtp = "123456";
  const client = {} as OtpIssueClient;
  const existingSignupInput = {
    email,
    purpose: "signup" as const,
    signupMode: "existing-user" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(issueOtp).mockResolvedValue({
      otp: createOtpProperties(emailOtp),
      userId: null,
      error: null,
    });

    vi.mocked(sendOtpEmail).mockResolvedValue(undefined);
  });

  it("기존 Signup OTP 발급과 이메일 전송이 성공하면 ok 결과를 반환한다", async () => {
    const result = await issueOtpAndSendEmailWithResult(
      existingSignupInput,
      client,
    );

    expect(result).toEqual({ ok: true });

    expect(issueOtp).toHaveBeenCalledWith({
      email,
      purpose: "signup",
      signupMode: "existing-user",
      client,
    });

    expect(sendOtpEmail).toHaveBeenCalledWith({
      email,
      purpose: "signup",
      otp: emailOtp,
    });
  });

  it("신규 Signup 입력을 password/metadata와 함께 issueOtp에 전달한다", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: createOtpProperties(emailOtp),
      userId: "new-user-id",
      error: null,
    });

    await issueOtpAndSendEmailWithResult(
      {
        email,
        purpose: "signup",
        signupMode: "new-user",
        password: "StrongPassword123!",
        metadata: {
          nickname: "딱다구리",
          canonical_email: email,
        },
      },
      client,
    );

    expect(issueOtp).toHaveBeenCalledWith({
      email,
      purpose: "signup",
      signupMode: "new-user",
      password: "StrongPassword123!",
      metadata: {
        nickname: "딱다구리",
        canonical_email: email,
      },
      client,
    });
  });

  it("Recovery 입력을 reset-password issueOtp 계약으로 전달한다", async () => {
    await issueOtpAndSendEmailWithResult(
      {
        email,
        purpose: "reset-password",
      },
      client,
    );

    expect(issueOtp).toHaveBeenCalledWith({
      email,
      purpose: "reset-password",
      client,
    });
  });

  it("신규 Signup은 userId 검증 후 beforeDelivery를 실행하고 그 다음 이메일을 발송한다", async () => {
    const callOrder: string[] = [];
    const beforeDelivery = vi.fn(async ({ userId }: { userId: string }) => {
      callOrder.push(`beforeDelivery:${userId}`);
    });

    vi.mocked(issueOtp).mockImplementation(async () => {
      callOrder.push("issueOtp");

      return {
        otp: createOtpProperties(emailOtp),
        userId: "new-user-id",
        error: null,
      };
    });
    vi.mocked(sendOtpEmail).mockImplementation(async () => {
      callOrder.push("sendOtpEmail");
    });

    await expect(
      issueOtpAndSendEmailWithResult(
        {
          email,
          purpose: "signup",
          signupMode: "new-user",
          password: "StrongPassword123!",
          metadata: {
            nickname: "딱다구리",
            canonical_email: email,
          },
          beforeDelivery,
        },
        client,
      ),
    ).resolves.toEqual({ ok: true });

    expect(beforeDelivery).toHaveBeenCalledWith({
      userId: "new-user-id",
    });
    expect(callOrder).toEqual([
      "issueOtp",
      "beforeDelivery:new-user-id",
      "sendOtpEmail",
    ]);
  });

  it("기존 Signup beforeDelivery는 caller context를 closure로 사용하도록 인자 없이 실행한다", async () => {
    const beforeDelivery = vi.fn(async () => undefined);

    await expect(
      issueOtpAndSendEmailWithResult(
        {
          ...existingSignupInput,
          beforeDelivery,
        },
        client,
      ),
    ).resolves.toEqual({ ok: true });

    expect(beforeDelivery).toHaveBeenCalledTimes(1);
    expect(beforeDelivery).toHaveBeenCalledWith();
  });

  it("beforeDelivery가 실패하면 typed failure로 변환하지 않고 reject하며 이메일을 발송하지 않는다", async () => {
    const error = new Error("agreement persistence failed");
    const beforeDelivery = vi.fn().mockRejectedValue(error);

    await expect(
      issueOtpAndSendEmailWithResult(
        {
          ...existingSignupInput,
          beforeDelivery,
        },
        client,
      ),
    ).rejects.toBe(error);

    expect(sendOtpEmail).not.toHaveBeenCalled();
  });

  it("신규 Signup에서 userId가 없으면 invalid_provider_response를 반환한다", async () => {
    const beforeDelivery = vi.fn(async () => undefined);

    vi.mocked(issueOtp).mockResolvedValue({
      otp: createOtpProperties(emailOtp),
      userId: null,
      error: null,
    });

    await expect(
      issueOtpAndSendEmailWithResult(
        {
          email,
          purpose: "signup",
          signupMode: "new-user",
          password: "StrongPassword123!",
          metadata: {
            nickname: "딱다구리",
            canonical_email: email,
          },
          beforeDelivery,
        },
        client,
      ),
    ).resolves.toEqual({
      ok: false,
      kind: "invalid_provider_response",
      diagnostic: {
        errorMessage: MISSING_SIGNUP_USER_ID_ERROR_MESSAGE,
        errorName: "Error",
      },
    });

    expect(beforeDelivery).not.toHaveBeenCalled();
    expect(sendOtpEmail).not.toHaveBeenCalled();
  });

  it("Provider HTTP 429를 provider_rate_limit으로 분류한다", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: null,
      userId: null,
      error: createAuthError({
        message: "rate limited",
        code: "unknown_rate_limit_code",
        status: 429,
      }),
    });

    await expect(
      issueOtpAndSendEmailWithResult(existingSignupInput, client),
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

  it("Provider rate-limit code를 provider_rate_limit으로 분류한다", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: null,
      userId: null,
      error: createAuthError({
        message: "email rate limited",
        code: "over_email_send_rate_limit",
        status: 400,
      }),
    });

    await expect(
      issueOtpAndSendEmailWithResult(existingSignupInput, client),
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

  it("일반 Provider 오류를 provider_error로 분류한다", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: null,
      userId: null,
      error: createAuthError({
        message: "provider failed",
        code: "unexpected_provider_error",
        status: 500,
      }),
    });

    await expect(
      issueOtpAndSendEmailWithResult(existingSignupInput, client),
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

  it("issueOtp 자체가 throw하면 provider_error로 fail-safe 처리한다", async () => {
    vi.mocked(issueOtp).mockRejectedValue(new Error("provider timeout"));

    await expect(
      issueOtpAndSendEmailWithResult(existingSignupInput, client),
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

  it("email_otp가 없으면 invalid_provider_response를 반환한다", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: createOtpProperties(""),
      userId: null,
      error: null,
    });

    await expect(
      issueOtpAndSendEmailWithResult(existingSignupInput, client),
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

  it("otp가 null이면 invalid_provider_response를 반환한다", async () => {
    vi.mocked(issueOtp).mockResolvedValue({
      otp: null,
      userId: null,
      error: null,
    });

    await expect(
      issueOtpAndSendEmailWithResult(existingSignupInput, client),
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

  it("이메일 발송이 실패하면 delivery_error를 반환한다", async () => {
    vi.mocked(sendOtpEmail).mockRejectedValue(new Error("send failed"));

    await expect(
      issueOtpAndSendEmailWithResult(existingSignupInput, client),
    ).resolves.toEqual({
      ok: false,
      kind: "delivery_error",
      diagnostic: {
        errorMessage: "send failed",
        errorName: "Error",
      },
    });
  });

  it("이메일 delivery timeout도 기존 delivery_error 계약으로 매핑한다", async () => {
    const timeoutError = new Error("OTP email delivery timed out.");
    timeoutError.name = "OtpEmailDeliveryTimeoutError";
    vi.mocked(sendOtpEmail).mockRejectedValue(timeoutError);

    await expect(
      issueOtpAndSendEmailWithResult(existingSignupInput, client),
    ).resolves.toEqual({
      ok: false,
      kind: "delivery_error",
      diagnostic: {
        errorMessage: "OTP email delivery timed out.",
        errorName: "OtpEmailDeliveryTimeoutError",
      },
    });
  });
});
