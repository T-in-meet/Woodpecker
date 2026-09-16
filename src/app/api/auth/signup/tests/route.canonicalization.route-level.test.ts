import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { issueOtpAndSendEmailWithResult } from "@/features/auth/email/issueOtpAndSendEmail";
import { MIN_RESPONSE_MS } from "@/features/auth/lib/applyMinimumResponseTime";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import type { OtpIssueRateLimitStartResult } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";

import { POST } from "../route";

const otpIssueRateLimitMock = vi.hoisted(() => ({
  precheckIssue: vi.fn((): OtpIssueRateLimitStartResult => ({ allowed: true })),
  tryStartIssue: vi.fn(),
  recordSuccessfulIssue: vi.fn(),
  releaseIssue: vi.fn(),
}));

const otpIssueClient = vi.hoisted(() => ({ client: "otp-issue-client" }));

vi.mock("@/features/auth/lib/rate-limit/otpIssueRateLimit", () => ({
  otpIssueRateLimit: otpIssueRateLimitMock,
}));

vi.mock("@/features/auth/lib/issueOtp", () => ({
  createOtpIssueClient: vi.fn(() => otpIssueClient),
}));

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/issueOtpAndSendEmail");

/**
 * canonical identity 테스트용 Signup 요청을 생성한다.
 *
 * @param email raw email
 * @param ip 요청 IP
 * @returns Signup POST 요청
 */
function makeRequest(email: string, ip: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({
      email,
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

/**
 * minimum response time을 함께 진행해 POST 결과를 반환한다.
 *
 * @param email raw email
 * @param ip 요청 IP
 * @returns Signup 응답
 */
async function postAfterMinimumTime(email: string, ip: string) {
  const promise = POST(makeRequest(email, ip));
  await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS);
  return promise;
}

describe("signup route canonical identity key contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.clearAllMocks();

    otpIssueRateLimitMock.tryStartIssue.mockReturnValue({ allowed: true });
    vi.mocked(getUserByEmail).mockResolvedValue({
      email: "stored-user@example.com",
      email_confirmed_at: null,
    } as never);
    vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("대소문자/공백 variant 입력에서도 lookup과 OTP Issue key는 canonical email로 수렴한다", async () => {
    const response = await postAfterMinimumTime(
      " Test@Example.com ",
      "10.0.0.1",
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);

    expect(otpIssueRateLimitMock.tryStartIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "test@example.com",
      ip: "10.0.0.1",
    });
    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("test@example.com");
  });

  it("raw variant 2개는 동일 OTP Issue identity key로 처리된다", async () => {
    await postAfterMinimumTime("Test@Example.com", "10.0.0.2");
    await postAfterMinimumTime(" test@example.com ", "10.0.0.3");

    expect(otpIssueRateLimitMock.tryStartIssue).toHaveBeenNthCalledWith(1, {
      purpose: "signup",
      canonicalEmail: "test@example.com",
      ip: "10.0.0.2",
    });
    expect(otpIssueRateLimitMock.tryStartIssue).toHaveBeenNthCalledWith(2, {
      purpose: "signup",
      canonicalEmail: "test@example.com",
      ip: "10.0.0.3",
    });

    expect(vi.mocked(getUserByEmail)).toHaveBeenNthCalledWith(
      1,
      "test@example.com",
    );
    expect(vi.mocked(getUserByEmail)).toHaveBeenNthCalledWith(
      2,
      "test@example.com",
    );
  });
});
