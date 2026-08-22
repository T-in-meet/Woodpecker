import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { issueOtpAndSendEmail } from "@/features/auth/email/issueOtpAndSendEmail";
import { MIN_RESPONSE_MS } from "@/features/auth/lib/applyMinimumResponseTime";
import {
  checkIpRateLimitPrecheck,
  checkRequestEligibility,
} from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";

import { POST } from "../route";

vi.mock("@/features/auth/lib/checkRequestEligibility");
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/issueOtpAndSendEmail");

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

    vi.mocked(checkIpRateLimitPrecheck).mockReturnValue({ allowed: true });
    vi.mocked(checkRequestEligibility).mockReturnValue({ allowed: true });
    vi.mocked(getUserByEmail).mockResolvedValue({
      email: "stored-user@example.com",
      email_confirmed_at: null,
    } as never);
    vi.mocked(issueOtpAndSendEmail).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("대소문자/공백 variant 입력에서도 lookup과 rate-limit key는 canonical email로 수렴한다", async () => {
    const response = await postAfterMinimumTime(
      " Test@Example.com ",
      "10.0.0.1",
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);

    expect(vi.mocked(checkRequestEligibility)).toHaveBeenCalledWith(
      "signup",
      "10.0.0.1",
      "test@example.com",
    );
    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("test@example.com");
  });

  it("raw variant 2개(Test@Example.com / 공백 포함 test@example.com)는 동일 identity key로 처리된다", async () => {
    await postAfterMinimumTime("Test@Example.com", "10.0.0.2");
    await postAfterMinimumTime(" test@example.com ", "10.0.0.3");

    expect(vi.mocked(checkRequestEligibility)).toHaveBeenNthCalledWith(
      1,
      "signup",
      "10.0.0.2",
      "test@example.com",
    );
    expect(vi.mocked(checkRequestEligibility)).toHaveBeenNthCalledWith(
      2,
      "signup",
      "10.0.0.3",
      "test@example.com",
    );

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
