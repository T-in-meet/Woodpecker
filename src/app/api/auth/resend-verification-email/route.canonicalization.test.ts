import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { MIN_RESPONSE_MS } from "@/features/auth/lib/applyMinimumResponseTime";
import { resetEligibilityStore } from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { resendVerificationEmail } from "@/features/auth/resend-verification-email/lib/resendVerificationEmail";

import { POST } from "./route";

vi.mock(
  "@/features/auth/resend-verification-email/lib/resendVerificationEmail",
);
vi.mock("@/features/auth/lib/getUserByEmail");

function makeRequest(email: string, ip: string): NextRequest {
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

async function postAfterMinimumTime(email: string, ip: string) {
  const promise = POST(makeRequest(email, ip));
  await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS);
  return promise;
}

describe("resend route canonicalization", () => {
  beforeEach(() => {
    resetEligibilityStore();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
    vi.mocked(getUserByEmail).mockImplementation(async (canonicalEmail) => ({
      email: `raw+alias+for+${canonicalEmail}`,
      email_confirmed_at: null,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("TC-01. Gmail plus alias는 canonical email로 조회되고, 조회된 raw email로 발송된다", async () => {
    const response = await postAfterMinimumTime(
      "user+tag@gmail.com",
      "10.0.0.1",
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);
    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("user@gmail.com");
    expect(vi.mocked(resendVerificationEmail)).toHaveBeenCalledWith(
      "raw+alias+for+user@gmail.com",
    );
  });

  it("TC-02. Gmail dot alias는 canonical email로 조회되고, 조회된 raw email로 발송된다", async () => {
    const response = await postAfterMinimumTime(
      "u.s.e.r@gmail.com",
      "10.0.0.2",
    );

    expect(response.status).toBe(200);
    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("user@gmail.com");
    expect(vi.mocked(resendVerificationEmail)).toHaveBeenCalledWith(
      "raw+alias+for+user@gmail.com",
    );
  });

  it("TC-03. googlemail.com은 gmail.com canonical로 조회되고, 조회된 raw email로 발송된다", async () => {
    const response = await postAfterMinimumTime(
      "User@GoogleMail.com",
      "10.0.0.3",
    );

    expect(response.status).toBe(200);
    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("user@gmail.com");
    expect(vi.mocked(resendVerificationEmail)).toHaveBeenCalledWith(
      "raw+alias+for+user@gmail.com",
    );
  });

  it("TC-04. non-Gmail은 canonical(소문자/trim)으로 조회되고, 조회된 raw email로 발송된다", async () => {
    const response = await postAfterMinimumTime(
      "User.Name+tag@Company.com",
      "10.0.0.4",
    );

    expect(response.status).toBe(200);
    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith(
      "user.name+tag@company.com",
    );
    expect(vi.mocked(resendVerificationEmail)).toHaveBeenCalledWith(
      "raw+alias+for+user.name+tag@company.com",
    );
  });
});
