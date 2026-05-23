import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { issueOtpAndSendEmail } from "@/features/auth/email/issueOtpAndSendEmail";
import { applyMinimumActionDelay } from "@/features/auth/lib/applyMinimumActionDelay";
import { logAuthError, logAuthEvent } from "@/features/auth/lib/authLogger";
import {
  checkRequestEligibility,
  mapBlockedByToReason,
} from "@/features/auth/lib/checkRequestEligibility";
import { getServerActionClientIp } from "@/lib/utils/getServerActionClientIp";

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
  normalizeUnknownError: vi.fn(() => ({ message: "normalized error" })),
}));

vi.mock("@/features/auth/lib/checkRequestEligibility", () => ({
  checkRequestEligibility: vi.fn(),
  mapBlockedByToReason: vi.fn(),
}));

vi.mock("@/features/auth/email/issueOtpAndSendEmail", () => ({
  issueOtpAndSendEmail: vi.fn(),
}));

vi.mock("@/lib/utils/getServerActionClientIp", () => ({
  getServerActionClientIp: vi.fn(),
}));

vi.mock("@/features/auth/lib/applyMinimumActionDelay", () => ({
  applyMinimumActionDelay: vi.fn(),
}));

const mockRedirect = vi.mocked(redirect);
const mockCheckRequestEligibility = vi.mocked(checkRequestEligibility);
const mockMapBlockedByToReason = vi.mocked(mapBlockedByToReason);
const mockIssueOtpAndSendEmail = vi.mocked(issueOtpAndSendEmail);
const mockGetServerActionClientIp = vi.mocked(getServerActionClientIp);
const mockApplyMinimumActionDelay = vi.mocked(applyMinimumActionDelay);
const mockLogAuthEvent = vi.mocked(logAuthEvent);
const mockLogAuthError = vi.mocked(logAuthError);

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

describe("resendEmailAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetServerActionClientIp.mockResolvedValue("127.0.0.1");
    mockCheckRequestEligibility.mockReturnValue({ allowed: true });
    mockIssueOtpAndSendEmail.mockResolvedValue(undefined);
    mockApplyMinimumActionDelay.mockResolvedValue(undefined);
  });

  it("context가 invalid이면 invalid_request를 반환하고 이후 로직을 호출하지 않는다", async () => {
    const formData = createFormData({
      email: "user@example.com",
    });

    const result = await resendEmailAction(
      null,
      INITIAL_RESEND_EMAIL_ACTION_STATE,
      formData,
    );

    expect(result).toEqual({
      status: "invalid_request",
      reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      fieldErrors: null,
    });

    expect(mockCheckRequestEligibility).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmail).not.toHaveBeenCalled();
    expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("email이 invalid이면 invalid_input을 반환하고 이후 로직을 호출하지 않는다", async () => {
    const formData = createFormData({
      email: "invalid-email",
      purpose: "signup",
    });

    const result = await resendEmailAction(
      null,
      INITIAL_RESEND_EMAIL_ACTION_STATE,
      formData,
    );

    expect(result.status).toBe("invalid_input");

    if (result.status === "invalid_input") {
      expect(result.fieldErrors.email).toBeDefined();
    }

    expect(mockCheckRequestEligibility).not.toHaveBeenCalled();
    expect(mockIssueOtpAndSendEmail).not.toHaveBeenCalled();
    expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("rate limit에 차단되면 blocked를 반환하고 OTP 발급/전송을 호출하지 않는다", async () => {
    mockCheckRequestEligibility.mockReturnValue({
      allowed: false,
      blockedBy: "emailShort",
    } as ReturnType<typeof checkRequestEligibility>);

    mockMapBlockedByToReason.mockReturnValue(
      AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT,
    );

    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
    });

    const result = await resendEmailAction(
      null,
      INITIAL_RESEND_EMAIL_ACTION_STATE,
      formData,
    );

    expect(result).toEqual({
      status: "blocked",
      reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT,
      fieldErrors: null,
    });

    expect(mockIssueOtpAndSendEmail).not.toHaveBeenCalled();
    expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("signup 목적에서 issueOtpAndSendEmail이 throw하면 internal_error를 반환한다", async () => {
    mockIssueOtpAndSendEmail.mockRejectedValue(new Error("email failed"));

    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
    });

    await expect(
      resendEmailAction(null, INITIAL_RESEND_EMAIL_ACTION_STATE, formData),
    ).resolves.toEqual({
      status: "internal_error",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      fieldErrors: null,
    });

    expect(mockLogAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESEND_EMAIL_FAILED,
      expect.objectContaining({
        status: 500,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );

    expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("reset-password 목적에서 issueOtpAndSendEmail이 throw해도 계정 탐지 방지를 위해 verify-otp로 redirect한다", async () => {
    mockIssueOtpAndSendEmail.mockRejectedValue(new Error("email failed"));

    const formData = createFormData({
      email: "user@example.com",
      purpose: "reset-password",
    });

    await expect(
      resendEmailAction(
        "/reset-password",
        INITIAL_RESEND_EMAIL_ACTION_STATE,
        formData,
      ),
    ).rejects.toThrow("NEXT_REDIRECT:");

    expect(mockIssueOtpAndSendEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      purpose: "reset-password",
    });

    expect(mockLogAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESEND_EMAIL_FAILED,
      expect.objectContaining({
        status: 500,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );

    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESEND_EMAIL_COMPLETED,
      expect.objectContaining({
        status: 200,
        provider: "password",
        result: "success",
      }),
    );

    expect(mockRedirect).toHaveBeenCalledTimes(1);

    const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;

    expect(redirectUrl).toContain("/verify-otp");
    expect(redirectUrl).toContain("purpose=reset-password");
    expect(redirectUrl).toContain("email=user%40example.com");
    expect(redirectUrl).toContain("redirect=%2Freset-password");
    expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("정상 성공하면 OTP 발급/전송 후 verify-otp로 redirect한다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
    });

    await expect(
      resendEmailAction(null, INITIAL_RESEND_EMAIL_ACTION_STATE, formData),
    ).rejects.toThrow("NEXT_REDIRECT:");

    expect(mockIssueOtpAndSendEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      purpose: "signup",
    });

    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESEND_EMAIL_COMPLETED,
      expect.objectContaining({
        status: 200,
        provider: "password",
        result: "success",
      }),
    );

    expect(mockRedirect).toHaveBeenCalledTimes(1);

    const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;

    expect(redirectUrl).toContain("/verify-otp");
    expect(redirectUrl).toContain("purpose=signup");
    expect(redirectUrl).toContain("email=user%40example.com");
    expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("redirectPath가 있으면 verify-otp redirect URL에 redirect query를 포함한다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "reset-password",
    });

    await expect(
      resendEmailAction(
        "/reset-password",
        INITIAL_RESEND_EMAIL_ACTION_STATE,
        formData,
      ),
    ).rejects.toThrow("NEXT_REDIRECT:");

    expect(mockIssueOtpAndSendEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      purpose: "reset-password",
    });

    expect(mockRedirect).toHaveBeenCalledTimes(1);

    const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;

    expect(redirectUrl).toContain("/verify-otp");
    expect(redirectUrl).toContain("purpose=reset-password");
    expect(redirectUrl).toContain("email=user%40example.com");
    expect(redirectUrl).toContain("redirect=%2Freset-password");
  });

  it("예상하지 못한 예외가 발생하면 internal_error를 반환한다", async () => {
    mockGetServerActionClientIp.mockRejectedValue(new Error("ip error"));

    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
    });

    const result = await resendEmailAction(
      null,
      INITIAL_RESEND_EMAIL_ACTION_STATE,
      formData,
    );

    expect(result).toEqual({
      status: "internal_error",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      fieldErrors: null,
    });

    expect(mockLogAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESEND_EMAIL_FAILED,
      expect.objectContaining({
        status: 500,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );

    expect(mockApplyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });
});
