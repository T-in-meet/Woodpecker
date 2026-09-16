import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { issueOtpAndSendEmailWithResult } from "@/features/auth/email/issueOtpAndSendEmail";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";

import { POST } from "../route";

const otpIssueRateLimitMock = vi.hoisted(() => ({
  precheckIssue: vi.fn(),
  tryStartIssue: vi.fn(),
  recordSuccessfulIssue: vi.fn(),
  releaseIssue: vi.fn(),
}));
const otpIssueClient = vi.hoisted(() => ({ client: "otp-issue-client" }));
const createOtpIssueClientMock = vi.hoisted(() => vi.fn(() => otpIssueClient));

vi.mock("@/features/auth/lib/rate-limit/otpIssueRateLimit", () => ({
  otpIssueRateLimit: otpIssueRateLimitMock,
}));
vi.mock("@/features/auth/lib/issueOtp", () => ({
  createOtpIssueClient: createOtpIssueClientMock,
}));
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/issueOtpAndSendEmail");
vi.mock("@/features/auth/lib/userAgreements", () => ({
  ensureUserAgreement: vi.fn(),
}));
vi.mock("@/features/auth/lib/applyMinimumResponseTime", () => ({
  applyMinimumResponseTime: vi.fn(
    async (_start: number, response: Response) => response,
  ),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify({
      email: "user@example.com",
      password: "Password123!",
      nickname: "tester",
      agreements: {
        termsOfService: true,
        privacyPolicyAcknowledged: true,
        age14OrOlder: true,
      },
    }),
  });
}

describe("Signup Route OTP Issue precheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    otpIssueRateLimitMock.precheckIssue.mockReturnValue({ allowed: true });
    otpIssueRateLimitMock.tryStartIssue.mockReturnValue({ allowed: true });
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "existing-user-id",
      email: "user@example.com",
      email_confirmed_at: "2026-09-16T00:00:00.000Z",
    } as never);
    vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValue({ ok: true });
  });

  it("precheck blocked면 account lookup 전에 fast-fail한다", async () => {
    otpIssueRateLimitMock.precheckIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "ip_short",
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(otpIssueRateLimitMock.precheckIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "user@example.com",
      ip: "203.0.113.10",
    });
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(createOtpIssueClientMock).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.tryStartIssue).not.toHaveBeenCalled();
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("precheck allowed 뒤에도 final tryStartIssue에서 다시 차단할 수 있다", async () => {
    otpIssueRateLimitMock.tryStartIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "cooldown",
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(otpIssueRateLimitMock.precheckIssue).toHaveBeenCalledTimes(1);
    expect(getUserByEmail).toHaveBeenCalledWith("user@example.com");
    expect(createOtpIssueClientMock).toHaveBeenCalledTimes(1);
    expect(otpIssueRateLimitMock.tryStartIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "user@example.com",
      ip: "203.0.113.10",
    });
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });
});
