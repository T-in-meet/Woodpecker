import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { issueAuthEmailLinkAndSend } from "@/features/auth/email/issueAuthEmailLinkAndSend";
import { MIN_RESPONSE_MS } from "@/features/auth/lib/applyMinimumResponseTime";
import { resetEligibilityStore } from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { resendVerificationEmail } from "@/features/auth/resend-verification-email/lib/resendVerificationEmail";

import { POST as signupPost } from "../signup/route";
import { POST as resendPost } from "./route";

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/issueAuthEmailLinkAndSend");
vi.mock(
  "@/features/auth/resend-verification-email/lib/resendVerificationEmail",
);

function makeSignupRequest(email: string, ip: string): NextRequest {
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
        privacyPolicy: true,
      },
    }),
  });
}

function makeResendRequest(email: string, ip: string): NextRequest {
  return new NextRequest(
    "http://localhost/api/auth/resend-verification-email",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ email }),
    },
  );
}

async function runSignup(email: string, ip: string) {
  const promise = signupPost(makeSignupRequest(email, ip));
  await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS);
  return promise;
}

async function runResend(email: string, ip: string) {
  const promise = resendPost(makeResendRequest(email, ip));
  await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS);
  return promise;
}

describe("auth cross-route canonical email rate-limit contract", () => {
  beforeEach(() => {
    resetEligibilityStore();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    vi.mocked(getUserByEmail).mockImplementation(async (canonicalEmail) => ({
      email: canonicalEmail,
      email_confirmed_at: null,
    }));
    vi.mocked(issueAuthEmailLinkAndSend).mockResolvedValue(undefined);
    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("signup 후 동일 canonical email로 resend를 즉시 호출하면 short window로 차단된다", async () => {
    const signupResponse = await runSignup(" Test@Example.com ", "10.210.0.1");
    expect(signupResponse.status).toBe(200);

    const resendResponse = await runResend("test@example.com", "10.210.0.2");
    const resendBody = await resendResponse.json();

    expect(resendResponse.status).toBe(429);
    expect(resendBody.code).toBe(AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED);
  });

  it("resend 후 동일 canonical email로 signup을 즉시 호출하면 short window로 차단된다", async () => {
    const resendResponse = await runResend(" Test@Example.com ", "10.220.0.1");
    expect(resendResponse.status).toBe(200);

    const signupResponse = await runSignup("test@example.com", "10.220.0.2");
    const signupBody = await signupResponse.json();

    expect(signupResponse.status).toBe(429);
    expect(signupBody.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  });
});
