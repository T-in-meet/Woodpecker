import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { issueOtpAndSendEmailWithResult } from "@/features/auth/email/issueOtpAndSendEmail";
import { applyMinimumActionDelay } from "@/features/auth/lib/applyMinimumActionDelay";
import { logAuthError, logAuthEvent } from "@/features/auth/lib/authLogger";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { createOtpIssueClient } from "@/features/auth/lib/issueOtp";
import type { OtpIssueIpPrecheckResult } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";
import { otpIssueRateLimit } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";
import { getTrustedAuthServerActionClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";
import { ensureUserAgreement } from "@/features/auth/lib/userAgreements";
import { VALIDATION_MESSAGES } from "@/lib/validation/messages";

import { resendEmailAction } from "./resendEmailAction";
import { INITIAL_RESEND_EMAIL_ACTION_STATE } from "./resendEmailActionState";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/features/auth/lib/authLogger", () => ({
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
  normalizeUnknownError: vi.fn((error: unknown) =>
    error instanceof Error
      ? { errorMessage: error.message, errorName: error.name }
      : { errorMessage: String(error), errorName: "UnknownError" },
  ),
}));

vi.mock("@/features/auth/email/issueOtpAndSendEmail", () => ({
  issueOtpAndSendEmailWithResult: vi.fn(),
}));

vi.mock("@/features/auth/lib/issueOtp", () => ({
  createOtpIssueClient: vi.fn(),
}));

vi.mock("@/features/auth/lib/rate-limit/otpIssueRateLimit", () => ({
  otpIssueRateLimit: {
    precheckIpIssue: vi.fn((): OtpIssueIpPrecheckResult => ({ allowed: true })),
    tryStartIssue: vi.fn(),
    recordSuccessfulIssue: vi.fn(),
    releaseIssue: vi.fn(),
  },
}));

vi.mock("@/features/auth/lib/rate-limit/trustedAuthClientIp", () => ({
  getTrustedAuthServerActionClientIp: vi.fn(),
}));

vi.mock("@/features/auth/lib/getUserByEmail", () => ({
  getUserByEmail: vi.fn(),
}));

vi.mock("@/features/auth/lib/userAgreements", () => ({
  ensureUserAgreement: vi.fn(),
}));

vi.mock("@/features/auth/lib/applyMinimumActionDelay", () => ({
  applyMinimumActionDelay: vi.fn(),
}));

const mockRedirect = vi.mocked(redirect);
const mockIssueOtpAndSendEmailWithResult = vi.mocked(
  issueOtpAndSendEmailWithResult,
);
const mockCreateOtpIssueClient = vi.mocked(createOtpIssueClient);
const mockTryStartIssue = vi.mocked(otpIssueRateLimit.tryStartIssue);
const mockRecordSuccessfulIssue = vi.mocked(
  otpIssueRateLimit.recordSuccessfulIssue,
);
const mockReleaseIssue = vi.mocked(otpIssueRateLimit.releaseIssue);
const mockGetTrustedAuthServerActionClientIp = vi.mocked(
  getTrustedAuthServerActionClientIp,
);
const mockGetUserByEmail = vi.mocked(getUserByEmail);
const mockEnsureUserAgreement = vi.mocked(ensureUserAgreement);
const mockApplyMinimumActionDelay = vi.mocked(applyMinimumActionDelay);
const mockLogAuthEvent = vi.mocked(logAuthEvent);
const mockLogAuthError = vi.mocked(logAuthError);
const mockPrecheckIpIssue = vi.mocked(otpIssueRateLimit.precheckIpIssue);

const OTP_ISSUE_CLIENT = { kind: "otp-issue-client" } as never;

function createFormData(values: {
  email?: string;
  purpose?: string;
}): FormData {
  const formData = new FormData();

  if (values.email !== undefined) {
    formData.set("email", values.email);
  }

  if (values.purpose !== undefined) {
    formData.set("purpose", values.purpose);
  }

  return formData;
}

async function callAction(input: {
  purpose: "signup" | "reset-password";
  email?: string;
  redirect?: string | null;
}) {
  return resendEmailAction(
    input.redirect ?? null,
    INITIAL_RESEND_EMAIL_ACTION_STATE,
    createFormData({
      email: input.email ?? "user@example.com",
      purpose: input.purpose,
    }),
  );
}

function mockIssueSuccess(): void {
  mockIssueOtpAndSendEmailWithResult.mockImplementation(async (input) => {
    if (input.purpose === "signup" && input.signupMode === "new-user") {
      if (input.beforeDelivery) {
        await input.beforeDelivery({ userId: "unused-new-user-id" });
      }
    } else if (input.beforeDelivery) {
      await input.beforeDelivery();
    }

    return { ok: true };
  });
}

describe("resendEmailAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetTrustedAuthServerActionClientIp.mockResolvedValue({
      available: true,
      ip: "203.0.113.10",
    });
    mockGetUserByEmail.mockResolvedValue({
      id: "user-id",
      email: "user@example.com",
      email_confirmed_at: "2026-09-16T00:00:00.000Z",
      auth_providers: ["email"],
    });
    mockEnsureUserAgreement.mockResolvedValue(undefined);
    mockCreateOtpIssueClient.mockReturnValue(OTP_ISSUE_CLIENT);
    mockTryStartIssue.mockReturnValue({ allowed: true });
    mockIssueSuccess();
    mockApplyMinimumActionDelay.mockResolvedValue(undefined);
  });

  it("context가 invalid이면 invalid_request를 반환하고 OTP Issue lifecycle을 시작하지 않는다", async () => {
    const result = await resendEmailAction(
      null,
      INITIAL_RESEND_EMAIL_ACTION_STATE,
      createFormData({ email: "user@example.com" }),
    );

    expect(result).toEqual({
      status: "invalid_request",
      reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      fieldErrors: null,
    });
    expect(mockGetTrustedAuthServerActionClientIp).not.toHaveBeenCalled();
    expect(mockCreateOtpIssueClient).not.toHaveBeenCalled();
    expect(mockTryStartIssue).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("email이 invalid이면 안전한 field error를 반환하고 OTP Issue lifecycle을 시작하지 않는다", async () => {
    const result = await callAction({
      purpose: "signup",
      email: "invalid-email",
    });

    expect(result).toEqual({
      status: "invalid_input",
      fieldErrors: {
        email: [VALIDATION_MESSAGES.emailInvalid],
      },
    });
    expect(mockTryStartIssue).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("email이 비어 있으면 필수 입력 field error를 반환한다", async () => {
    const result = await callAction({
      purpose: "signup",
      email: "   ",
    });

    expect(result).toEqual({
      status: "invalid_input",
      fieldErrors: {
        email: [VALIDATION_MESSAGES.emailRequired],
      },
    });
  });

  it("trusted IP를 확보하지 못하면 fail-closed하고 Provider를 시작하지 않는다", async () => {
    mockGetTrustedAuthServerActionClientIp.mockResolvedValue({
      available: false,
      reasonCode: AUTH_LOG_REASONS.IP_UNAVAILABLE,
    });

    const result = await callAction({ purpose: "signup" });

    expect(result).toEqual({
      status: "internal_error",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      fieldErrors: null,
    });
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mockCreateOtpIssueClient).not.toHaveBeenCalled();
    expect(mockTryStartIssue).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("Signup IP-only precheck 차단은 account lookup 전에 blocked를 반환한다", async () => {
    mockPrecheckIpIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "ip_short",
    });

    const result = await callAction({ purpose: "signup" });

    expect(result).toEqual({
      status: "blocked",
      reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT,
      fieldErrors: null,
    });
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mockCreateOtpIssueClient).not.toHaveBeenCalled();
    expect(mockTryStartIssue).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("Signup account lookup 자체가 실패하면 pre-account internal_error를 유지한다", async () => {
    mockGetUserByEmail.mockRejectedValueOnce(
      new Error("account lookup failed"),
    );

    const result = await callAction({ purpose: "signup" });

    expect(result).toEqual({
      status: "internal_error",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      fieldErrors: null,
    });
    expect(mockCreateOtpIssueClient).not.toHaveBeenCalled();
    expect(mockTryStartIssue).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("signup resend에서 사용자가 존재하지 않으면 cooldown/IP attempt를 소비하지 않고 success-like redirect한다", async () => {
    mockGetUserByEmail.mockResolvedValue(null);

    await expect(callAction({ purpose: "signup" })).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockCreateOtpIssueClient).not.toHaveBeenCalled();
    // tryStartIssue() 자체를 호출하지 않으므로 cooldown / IP attempt / in-flight를 소비하지 않는다.
    expect(mockTryStartIssue).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(mockEnsureUserAgreement).not.toHaveBeenCalled();
    expect(mockRecordSuccessfulIssue).not.toHaveBeenCalled();
    expect(mockReleaseIssue).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it("signup existing account의 final Local Rate Limit 차단은 Provider/agreement side effect 없이 success-like redirect한다", async () => {
    mockGetUserByEmail.mockResolvedValue({
      id: "user-id",
      email: "user@example.com",
      email_confirmed_at: null,
      auth_providers: ["email"],
    });
    mockTryStartIssue.mockReturnValue({
      allowed: false,
      blockedBy: "cooldown",
    });

    await expect(callAction({ purpose: "signup" })).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(mockEnsureUserAgreement).not.toHaveBeenCalled();
    expect(mockRecordSuccessfulIssue).not.toHaveBeenCalled();
    expect(mockReleaseIssue).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it("reset-password Local Rate Limit 차단은 Provider를 시작하지 않고 success-like redirect한다", async () => {
    mockTryStartIssue.mockReturnValue({
      allowed: false,
      blockedBy: "ip_short",
    });

    await expect(
      callAction({ purpose: "reset-password", redirect: "/reset-password" }),
    ).rejects.toThrow("NEXT_REDIRECT:");

    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(mockRecordSuccessfulIssue).not.toHaveBeenCalled();
    expect(mockReleaseIssue).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it("reset-password resend에서 OTP client 생성 실패는 lifecycle을 시작하지 않고 success-like redirect한다", async () => {
    mockCreateOtpIssueClient.mockImplementationOnce(() => {
      throw new Error("otp client creation failed");
    });

    await expect(callAction({ purpose: "reset-password" })).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockCreateOtpIssueClient).toHaveBeenCalledTimes(1);
    expect(mockTryStartIssue).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(mockRecordSuccessfulIssue).not.toHaveBeenCalled();
    expect(mockReleaseIssue).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it("signup existing account에서 OTP client 생성 실패는 lifecycle을 시작하지 않고 success-like redirect한다", async () => {
    mockCreateOtpIssueClient.mockImplementationOnce(() => {
      throw new Error("otp client creation failed");
    });

    await expect(callAction({ purpose: "signup" })).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockCreateOtpIssueClient).toHaveBeenCalledTimes(1);
    expect(mockTryStartIssue).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(mockRecordSuccessfulIssue).not.toHaveBeenCalled();
    expect(mockReleaseIssue).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it("signup resend는 existing-user magiclink typed input으로 호출하고 성공 quota를 기록한다", async () => {
    await expect(callAction({ purpose: "signup" })).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockGetUserByEmail).toHaveBeenCalledWith("user@example.com");
    expect(mockTryStartIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "user@example.com",
      ip: "203.0.113.10",
    });
    expect(mockIssueOtpAndSendEmailWithResult).toHaveBeenCalledWith(
      {
        email: "user@example.com",
        purpose: "signup",
        signupMode: "existing-user",
      },
      OTP_ISSUE_CLIENT,
    );
    expect(mockRecordSuccessfulIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "user@example.com",
    });
    expect(mockReleaseIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "user@example.com",
    });
  });

  it("reset-password resend는 recovery typed input을 사용하고 account lookup을 하지 않는다", async () => {
    await expect(callAction({ purpose: "reset-password" })).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).toHaveBeenCalledWith(
      {
        email: "user@example.com",
        purpose: "reset-password",
      },
      OTP_ISSUE_CLIENT,
    );
    expect(mockRecordSuccessfulIssue).toHaveBeenCalledWith({
      purpose: "reset-password",
      canonicalEmail: "user@example.com",
    });
  });

  it("signup resend에서 기존 미인증 사용자는 Email 전에 동일 user id agreement를 복구한다", async () => {
    mockGetUserByEmail.mockResolvedValue({
      id: "unverified-user-id",
      email: "stored@example.com",
      email_confirmed_at: null,
      auth_providers: ["email"],
    });

    await expect(callAction({ purpose: "signup" })).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockIssueOtpAndSendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "stored@example.com",
        purpose: "signup",
        signupMode: "existing-user",
        beforeDelivery: expect.any(Function),
      }),
      OTP_ISSUE_CLIENT,
    );
    expect(mockEnsureUserAgreement).toHaveBeenCalledWith(
      "unverified-user-id",
      "email",
    );
  });

  it("signup resend에서 인증 완료 사용자는 agreement persistence를 확대하지 않는다", async () => {
    mockGetUserByEmail.mockResolvedValue({
      id: "confirmed-user-id",
      email: "user@example.com",
      email_confirmed_at: "2026-09-16T00:00:00.000Z",
      auth_providers: ["email"],
    });

    await expect(callAction({ purpose: "signup" })).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockEnsureUserAgreement).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).toHaveBeenCalledWith(
      {
        email: "user@example.com",
        purpose: "signup",
        signupMode: "existing-user",
      },
      OTP_ISSUE_CLIENT,
    );
  });

  it("agreement 복구가 실패하면 signup은 success-like redirect하고 success quota 없이 release한다", async () => {
    mockGetUserByEmail.mockResolvedValue({
      id: "unverified-user-id",
      email: "user@example.com",
      email_confirmed_at: null,
      auth_providers: ["email"],
    });
    mockEnsureUserAgreement.mockRejectedValue(new Error("agreement failed"));

    await expect(callAction({ purpose: "signup" })).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockRecordSuccessfulIssue).not.toHaveBeenCalled();
    expect(mockReleaseIssue).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it("signup Provider 429는 내부 reason을 유지하되 외부에는 success-like redirect한다", async () => {
    mockIssueOtpAndSendEmailWithResult.mockResolvedValue({
      ok: false,
      kind: "provider_rate_limit",
      diagnostic: {
        errorMessage: "rate limited",
        errorName: "AuthApiError",
      },
    });

    await expect(callAction({ purpose: "signup" })).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESEND_EMAIL_RATE_LIMITED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
      }),
    );
    expect(mockRecordSuccessfulIssue).not.toHaveBeenCalled();
    expect(mockReleaseIssue).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it.each([
    "provider_rate_limit",
    "provider_error",
    "invalid_provider_response",
    "delivery_error",
  ] as const)(
    "reset-password %s 실패는 success-like redirect하고 successful quota를 기록하지 않는다",
    async (kind) => {
      mockIssueOtpAndSendEmailWithResult.mockResolvedValue({
        ok: false,
        kind,
        diagnostic: {
          errorMessage: `${kind} message`,
          errorName: "TestError",
        },
      });

      await expect(callAction({ purpose: "reset-password" })).rejects.toThrow(
        "NEXT_REDIRECT:",
      );

      expect(mockRecordSuccessfulIssue).not.toHaveBeenCalled();
      expect(mockReleaseIssue).toHaveBeenCalledTimes(1);
      expect(mockRedirect).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    "provider_error",
    "invalid_provider_response",
    "delivery_error",
  ] as const)(
    "signup %s 실패는 내부 reason을 유지하되 success-like redirect하고 successful quota 없이 release한다",
    async (kind) => {
      mockIssueOtpAndSendEmailWithResult.mockResolvedValue({
        ok: false,
        kind,
        diagnostic: {
          errorMessage: `${kind} message`,
          errorName: "TestError",
        },
      });

      await expect(callAction({ purpose: "signup" })).rejects.toThrow(
        "NEXT_REDIRECT:",
      );

      expect(mockLogAuthError).toHaveBeenCalledWith(
        AUTH_EVENTS.AUTH_RESEND_EMAIL_FAILED,
        expect.objectContaining({
          reasonCode:
            kind === "delivery_error"
              ? AUTH_LOG_REASONS.EMAIL_DELIVERY_ERROR
              : AUTH_LOG_REASONS.PROVIDER_ERROR,
        }),
      );
      expect(mockRecordSuccessfulIssue).not.toHaveBeenCalled();
      expect(mockReleaseIssue).toHaveBeenCalledTimes(1);
      expect(mockRedirect).toHaveBeenCalledTimes(1);
    },
  );

  it("reset-password helper throw도 success-like redirect하고 in-flight를 release한다", async () => {
    mockIssueOtpAndSendEmailWithResult.mockRejectedValue(
      new Error("unexpected issue error"),
    );

    await expect(callAction({ purpose: "reset-password" })).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockRecordSuccessfulIssue).not.toHaveBeenCalled();
    expect(mockReleaseIssue).toHaveBeenCalledTimes(1);
    expect(mockLogAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESEND_EMAIL_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
  });

  it("redirectPath가 있으면 verify-otp redirect URL에 redirect query를 포함한다", async () => {
    await expect(
      callAction({
        purpose: "reset-password",
        redirect: "/reset-password",
      }),
    ).rejects.toThrow("NEXT_REDIRECT:");

    const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
    expect(redirectUrl).toContain("purpose=reset-password");
    expect(redirectUrl).toContain("email=user%40example.com");
    expect(redirectUrl).toContain("redirect=%2Freset-password");
  });

  describe("minimum action delay", () => {
    it("invalid request에서도 적용한다", async () => {
      const result = await resendEmailAction(
        null,
        INITIAL_RESEND_EMAIL_ACTION_STATE,
        createFormData({ email: "user@example.com" }),
      );

      expect(result.status).toBe("invalid_request");
      expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
    });

    it("trusted IP fail-closed에서도 적용한다", async () => {
      mockGetTrustedAuthServerActionClientIp.mockResolvedValueOnce({
        available: false,
        reasonCode: AUTH_LOG_REASONS.IP_UNAVAILABLE,
      });

      const result = await callAction({ purpose: "signup" });

      expect(result.status).toBe("internal_error");
      expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
    });

    it("Signup account-dependent Local Rate Limit 차단에서도 적용한다", async () => {
      mockTryStartIssue.mockReturnValueOnce({
        allowed: false,
        blockedBy: "cooldown",
      });

      await expect(callAction({ purpose: "signup" })).rejects.toThrow(
        "NEXT_REDIRECT:",
      );

      expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
    });

    it("Signup account-dependent typed failure에서도 적용한다", async () => {
      mockIssueOtpAndSendEmailWithResult.mockResolvedValueOnce({
        ok: false,
        kind: "delivery_error",
        diagnostic: {
          errorMessage: "delivery failed",
          errorName: "TestError",
        },
      });

      await expect(callAction({ purpose: "signup" })).rejects.toThrow(
        "NEXT_REDIRECT:",
      );

      expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
    });

    it("Recovery success-like redirect에서도 적용한다", async () => {
      mockTryStartIssue.mockReturnValueOnce({
        allowed: false,
        blockedBy: "ip_short",
      });

      await expect(callAction({ purpose: "reset-password" })).rejects.toThrow(
        "NEXT_REDIRECT:",
      );

      expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
    });

    it("성공 redirect에서도 적용한다", async () => {
      await expect(callAction({ purpose: "signup" })).rejects.toThrow(
        "NEXT_REDIRECT:",
      );

      expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
    });
  });
});
