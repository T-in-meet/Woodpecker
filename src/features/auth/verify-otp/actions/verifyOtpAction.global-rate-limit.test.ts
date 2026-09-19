import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { AUTH_EVENTS } from "../../constants/authEvents";
import { AUTH_LOG_REASONS } from "../../constants/authLogReasons";
import { applyMinimumActionDelay } from "../../lib/applyMinimumActionDelay";
import { logAuthEvent } from "../../lib/authLogger";
import { authGlobalRequestRateLimit } from "../../lib/rate-limit/authGlobalRequestRateLimit";
import { otpVerifyRateLimit } from "../../lib/rate-limit/otpVerifyRateLimit";
import { getTrustedAuthServerActionClientIp } from "../../lib/rate-limit/trustedAuthClientIp";
import { verifyOtp } from "../lib/verifyOtp";
import { verifyOtpAction } from "./verifyOtpAction";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("../../lib/authLogger", () => ({
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
  normalizeUnknownError: vi.fn(() => ({
    message: "normalized error",
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../../lib/rate-limit/trustedAuthClientIp", () => ({
  getTrustedAuthServerActionClientIp: vi.fn(),
}));

vi.mock("../../lib/rate-limit/authGlobalRequestRateLimit", () => ({
  authGlobalRequestRateLimit: {
    tryConsume: vi.fn(),
  },
}));

vi.mock("../../lib/rate-limit/otpVerifyRateLimit", () => ({
  otpVerifyRateLimit: {
    tryStartAttempt: vi.fn(),
    recordResult: vi.fn(),
  },
}));

vi.mock("../lib/verifyOtp", () => ({
  verifyOtp: vi.fn(),
}));

vi.mock("../../lib/setPasswordIntent", () => ({
  createSetPasswordIntent: vi.fn(),
}));

vi.mock("../../lib/signedResetPasswordIntent", () => ({
  createSignedResetPasswordIntent: vi.fn(),
}));

vi.mock("../../lib/applyMinimumActionDelay", () => ({
  applyMinimumActionDelay: vi.fn(),
}));

const prevState = {
  status: "idle",
  fieldErrors: null,
} as const;

function createFormData(input: {
  email?: string;
  purpose?: string;
  otp?: string;
}) {
  const formData = new FormData();

  if (input.email !== undefined) formData.set("email", input.email);
  if (input.purpose !== undefined) formData.set("purpose", input.purpose);
  if (input.otp !== undefined) formData.set("otp", input.otp);

  return formData;
}

describe("verifyOtpAction - Auth Global request guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getTrustedAuthServerActionClientIp).mockResolvedValue({
      available: true,
      ip: "127.0.0.1",
    });

    vi.mocked(authGlobalRequestRateLimit.tryConsume).mockReturnValue({
      allowed: true,
    });

    vi.mocked(applyMinimumActionDelay).mockResolvedValue(undefined);
  });

  it("context 검증 실패는 Auth Global budget을 소비하지 않는다", async () => {
    const result = await verifyOtpAction(
      null,
      prevState,
      createFormData({ otp: "123456" }),
    );

    expect(result).toEqual({
      status: "invalid_request",
      fieldErrors: null,
    });
    expect(getTrustedAuthServerActionClientIp).not.toHaveBeenCalled();
    expect(authGlobalRequestRateLimit.tryConsume).not.toHaveBeenCalled();
  });

  it("OTP 입력 검증 실패는 Auth Global budget을 소비하지 않는다", async () => {
    const result = await verifyOtpAction(
      null,
      prevState,
      createFormData({
        email: "user@example.com",
        purpose: "signup",
        otp: "invalid-otp",
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(getTrustedAuthServerActionClientIp).not.toHaveBeenCalled();
    expect(authGlobalRequestRateLimit.tryConsume).not.toHaveBeenCalled();
  });

  it("trusted IP를 확보하지 못하면 Auth Global guard를 호출하지 않는다", async () => {
    vi.mocked(getTrustedAuthServerActionClientIp).mockResolvedValue({
      available: false,
      reasonCode: AUTH_LOG_REASONS.IP_UNAVAILABLE,
    });

    const result = await verifyOtpAction(
      null,
      prevState,
      createFormData({
        email: "user@example.com",
        purpose: "signup",
        otp: "123456",
      }),
    );

    expect(result).toEqual({
      status: "internal_error",
      fieldErrors: null,
    });
    expect(authGlobalRequestRateLimit.tryConsume).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(otpVerifyRateLimit.tryStartAttempt).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("Auth Global 차단은 기존 blocked 상태를 반환하고 downstream을 호출하지 않는다", async () => {
    vi.mocked(authGlobalRequestRateLimit.tryConsume).mockReturnValue({
      allowed: false,
      blockedBy: "ip_short",
    });

    const result = await verifyOtpAction(
      null,
      prevState,
      createFormData({
        email: "user@example.com",
        purpose: "signup",
        otp: "123456",
      }),
    );

    expect(result).toEqual({
      status: "blocked",
      fieldErrors: null,
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(otpVerifyRateLimit.tryStartAttempt).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_RATE_LIMITED,
      expect.objectContaining({
        status: 429,
        result: "blocked",
        reasonCode: AUTH_LOG_REASONS.AUTH_GLOBAL_IP_LIMIT,
      }),
    );
  });
});
