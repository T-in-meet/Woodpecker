import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { issueOtpAndSendEmailWithResult } from "@/features/auth/email/issueOtpAndSendEmail";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { createOtpIssueClient } from "@/features/auth/lib/issueOtp";
import { authGlobalRequestRateLimit } from "@/features/auth/lib/rate-limit/authGlobalRequestRateLimit";
import { otpIssueRateLimit } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";
import { signupResendRequestRateLimit } from "@/features/auth/lib/rate-limit/signupResendRequestRateLimit";
import { getTrustedAuthServerActionClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";

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
vi.mock("@/features/auth/lib/rate-limit/authGlobalRequestRateLimit", () => ({
  authGlobalRequestRateLimit: {
    tryConsume: vi.fn(),
  },
}));
vi.mock("@/features/auth/lib/rate-limit/otpIssueRateLimit", () => ({
  otpIssueRateLimit: {
    precheckIpIssue: vi.fn(),
    tryStartIssue: vi.fn(),
    recordSuccessfulIssue: vi.fn(),
    releaseIssue: vi.fn(),
  },
}));
vi.mock("@/features/auth/lib/rate-limit/signupResendRequestRateLimit", () => ({
  signupResendRequestRateLimit: {
    tryConsume: vi.fn(),
  },
}));
vi.mock("@/features/auth/lib/rate-limit/trustedAuthClientIp", () => ({
  getTrustedAuthServerActionClientIp: vi.fn(),
}));
vi.mock("@/features/auth/lib/getUserByEmail", () => ({
  getUserByEmail: vi.fn(),
}));
vi.mock("@/features/auth/lib/userAgreements", () => ({
  recordCurrentLegalAcceptances: vi.fn(),
}));
vi.mock("@/features/auth/lib/applyMinimumActionDelay", () => ({
  applyMinimumActionDelay: vi.fn(),
}));

const mockRedirect = vi.mocked(redirect);
const mockIssueOtpAndSendEmailWithResult = vi.mocked(
  issueOtpAndSendEmailWithResult,
);
const mockCreateOtpIssueClient = vi.mocked(createOtpIssueClient);
const mockGlobalTryConsume = vi.mocked(authGlobalRequestRateLimit.tryConsume);
const mockPrecheckIpIssue = vi.mocked(otpIssueRateLimit.precheckIpIssue);
const mockSignupResendTryConsume = vi.mocked(
  signupResendRequestRateLimit.tryConsume,
);
const mockTryStartIssue = vi.mocked(otpIssueRateLimit.tryStartIssue);
const mockGetTrustedAuthServerActionClientIp = vi.mocked(
  getTrustedAuthServerActionClientIp,
);
const mockGetUserByEmail = vi.mocked(getUserByEmail);

const OTP_ISSUE_CLIENT = { kind: "otp-issue-client" } as never;

function createFormData(purpose: "signup" | "reset-password"): FormData {
  const formData = new FormData();
  formData.set("email", "user@example.com");
  formData.set("purpose", purpose);
  return formData;
}

async function callAction(purpose: "signup" | "reset-password") {
  return resendEmailAction(
    null,
    INITIAL_RESEND_EMAIL_ACTION_STATE,
    createFormData(purpose),
  );
}

describe("Signup Resend IP-only precheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTrustedAuthServerActionClientIp.mockResolvedValue({
      available: true,
      ip: "203.0.113.10",
    });
    mockGlobalTryConsume.mockReturnValue({ allowed: true });
    mockPrecheckIpIssue.mockReturnValue({ allowed: true });
    mockSignupResendTryConsume.mockReturnValue({ allowed: true });
    mockTryStartIssue.mockReturnValue({ allowed: true });
    mockGetUserByEmail.mockResolvedValue({
      id: "user-id",
      email: "user@example.com",
      email_confirmed_at: "2026-09-16T00:00:00.000Z",
      auth_providers: ["email"],
    });
    mockCreateOtpIssueClient.mockReturnValue(OTP_ISSUE_CLIENT);
    mockIssueOtpAndSendEmailWithResult.mockResolvedValue({ ok: true });
  });

  it("signup Auth Global 차단은 account-independent blocked 상태로 종료하고 downstream을 호출하지 않는다", async () => {
    mockGlobalTryConsume.mockReturnValueOnce({
      allowed: false,
      blockedBy: "ip_short",
    });

    const result = await callAction("signup");

    expect(result).toEqual({
      status: "blocked",
      reasonCode: AUTH_LOG_REASONS.AUTH_GLOBAL_IP_LIMIT,
      fieldErrors: null,
    });
    expect(mockPrecheckIpIssue).not.toHaveBeenCalled();
    expect(mockSignupResendTryConsume).not.toHaveBeenCalled();
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mockCreateOtpIssueClient).not.toHaveBeenCalled();
    expect(mockTryStartIssue).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("reset-password Auth Global 차단은 success-like redirect하고 downstream을 호출하지 않는다", async () => {
    mockGlobalTryConsume.mockReturnValueOnce({
      allowed: false,
      blockedBy: "ip_short",
    });

    await expect(callAction("reset-password")).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockPrecheckIpIssue).not.toHaveBeenCalled();
    expect(mockSignupResendTryConsume).not.toHaveBeenCalled();
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mockCreateOtpIssueClient).not.toHaveBeenCalled();
    expect(mockTryStartIssue).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it("signup IP precheck blocked면 account lookup 전에 blockedState를 반환한다", async () => {
    mockPrecheckIpIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "ip_short",
    });

    const result = await callAction("signup");

    expect(result).toEqual({
      status: "blocked",
      reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT,
      fieldErrors: null,
    });
    expect(mockPrecheckIpIssue).toHaveBeenCalledWith({
      ip: "203.0.113.10",
    });
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mockCreateOtpIssueClient).not.toHaveBeenCalled();
    expect(mockTryStartIssue).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("signup precheck allowed + nonexistent면 기존 success-like/no-consume 경계를 유지한다", async () => {
    mockGetUserByEmail.mockResolvedValueOnce(null);

    await expect(callAction("signup")).rejects.toThrow("NEXT_REDIRECT:");

    expect(mockPrecheckIpIssue).toHaveBeenCalledTimes(1);
    expect(mockSignupResendTryConsume).toHaveBeenCalledTimes(1);
    expect(mockGetUserByEmail).toHaveBeenCalledWith("user@example.com");
    expect(mockCreateOtpIssueClient).not.toHaveBeenCalled();
    expect(mockTryStartIssue).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it("reset-password resend에는 Signup 전용 IP-only precheck/request limiter를 적용하지 않는다", async () => {
    await expect(callAction("reset-password")).rejects.toThrow(
      "NEXT_REDIRECT:",
    );

    expect(mockPrecheckIpIssue).not.toHaveBeenCalled();
    expect(mockSignupResendTryConsume).not.toHaveBeenCalled();
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mockTryStartIssue).toHaveBeenCalledWith({
      purpose: "reset-password",
      canonicalEmail: "user@example.com",
      ip: "203.0.113.10",
    });
    expect(mockIssueOtpAndSendEmailWithResult).toHaveBeenCalledTimes(1);
  });
});
