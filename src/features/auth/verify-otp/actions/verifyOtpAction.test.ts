import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { AUTH_EVENTS } from "../../constants/authEvents";
import { AUTH_LOG_REASONS } from "../../constants/authLogReasons";
import { INVALID_OTP_ERROR_MESSAGE } from "../../constants/otp";
import { applyMinimumActionDelay } from "../../lib/applyMinimumActionDelay";
import { logAuthError, logAuthEvent } from "../../lib/authLogger";
import { authGlobalRequestRateLimit } from "../../lib/rate-limit/authGlobalRequestRateLimit";
import {
  otpVerifyRateLimit,
  OtpVerifyRateLimitBlockedBy,
} from "../../lib/rate-limit/otpVerifyRateLimit";
import { getTrustedAuthServerActionClientIp } from "../../lib/rate-limit/trustedAuthClientIp";
import { createSetPasswordIntent } from "../../lib/setPasswordIntent";
import { createSignedResetPasswordIntent } from "../../lib/signedResetPasswordIntent";
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

import { redirect } from "next/navigation";

const prevState = {
  status: "idle",
  fieldErrors: null,
} as const;

const mockSupabase = {
  auth: {
    verifyOtp: vi.fn(),
  },
} as never;

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

function createProviderError(input: { status: number; code: string }) {
  return {
    name: "AuthApiError",
    message: "provider error",
    status: input.status,
    code: input.code,
  };
}

describe("verifyOtpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getTrustedAuthServerActionClientIp).mockResolvedValue({
      available: true,
      ip: "127.0.0.1",
    });

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    vi.mocked(authGlobalRequestRateLimit.tryConsume).mockReturnValue({
      allowed: true,
    });

    vi.mocked(otpVerifyRateLimit.tryStartAttempt).mockReturnValue({
      allowed: true,
    });

    vi.mocked(verifyOtp).mockResolvedValue({
      data: {
        user: {
          id: "verified-user-id",
        },
      },
      error: null,
    } as Awaited<ReturnType<typeof verifyOtp>>);

    vi.mocked(createSetPasswordIntent).mockResolvedValue(undefined);
    vi.mocked(createSignedResetPasswordIntent).mockResolvedValue(undefined);
    vi.mocked(applyMinimumActionDelay).mockResolvedValue(undefined);
  });

  it("signup OTP 인증에 성공하면 비밀번호 설정 페이지로 redirect한다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    await expect(verifyOtpAction(null, prevState, formData)).rejects.toThrow(
      `NEXT_REDIRECT:${ROUTES.SET_PASSWORD}`,
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      supabase: mockSupabase,
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    expect(otpVerifyRateLimit.recordResult).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      outcome: "success",
    });
    expect(redirect).toHaveBeenCalledWith(ROUTES.SET_PASSWORD);
    expect(createSignedResetPasswordIntent).not.toHaveBeenCalled();
    expect(applyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("signup OTP 인증에 성공하고 redirectPath가 있으면 비밀번호 설정 페이지에 redirect query를 포함한다", async () => {
    const redirectPath = "/notes";
    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });
    const expectedPath = `${ROUTES.SET_PASSWORD}?redirect=${encodeURIComponent(
      redirectPath,
    )}`;

    await expect(
      verifyOtpAction(redirectPath, prevState, formData),
    ).rejects.toThrow(`NEXT_REDIRECT:${expectedPath}`);

    expect(redirect).toHaveBeenCalledWith(expectedPath);
    expect(createSignedResetPasswordIntent).not.toHaveBeenCalled();
    expect(applyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("signup OTP 인증 성공 시 Provider user id로 Set Password Intent를 발급한다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    await expect(verifyOtpAction(null, prevState, formData)).rejects.toThrow(
      `NEXT_REDIRECT:${ROUTES.SET_PASSWORD}`,
    );

    expect(createSetPasswordIntent).toHaveBeenCalledTimes(1);
    expect(createSetPasswordIntent).toHaveBeenCalledWith({
      userId: "verified-user-id",
    });
    expect(createSignedResetPasswordIntent).not.toHaveBeenCalled();

    expect(
      vi.mocked(otpVerifyRateLimit.recordResult).mock.invocationCallOrder[0]!,
    ).toBeLessThan(
      vi.mocked(createSetPasswordIntent).mock.invocationCallOrder[0]!,
    );
  });

  it("client가 userId를 전달해도 Set Password Intent는 Provider user id만 사용한다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });
    formData.set("userId", "client-controlled-user-id");

    await expect(verifyOtpAction(null, prevState, formData)).rejects.toThrow(
      `NEXT_REDIRECT:${ROUTES.SET_PASSWORD}`,
    );

    expect(createSetPasswordIntent).toHaveBeenCalledWith({
      userId: "verified-user-id",
    });
    expect(createSetPasswordIntent).not.toHaveBeenCalledWith({
      userId: "client-controlled-user-id",
    });
    expect(createSignedResetPasswordIntent).not.toHaveBeenCalled();
  });

  it("signup Verify 응답에 authenticated user가 없으면 success로 기록하지 않고 fail-closed한다", async () => {
    vi.mocked(verifyOtp).mockResolvedValue({
      data: {
        user: null,
      },
      error: null,
    } as Awaited<ReturnType<typeof verifyOtp>>);

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
    expect(otpVerifyRateLimit.recordResult).not.toHaveBeenCalled();
    expect(logAuthEvent).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_COMPLETED,
      expect.anything(),
    );
    expect(createSetPasswordIntent).not.toHaveBeenCalled();
    expect(createSignedResetPasswordIntent).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("signup Verify 성공 후 Set Password Intent 발급이 실패하면 internal_error로 종료한다", async () => {
    vi.mocked(createSetPasswordIntent).mockRejectedValue(
      new Error("set password intent failed"),
    );

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
    expect(otpVerifyRateLimit.recordResult).toHaveBeenCalledTimes(1);
    expect(otpVerifyRateLimit.recordResult).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      outcome: "success",
    });
    expect(logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_COMPLETED,
      expect.anything(),
    );
    expect(createSetPasswordIntent).toHaveBeenCalledWith({
      userId: "verified-user-id",
    });
    expect(createSignedResetPasswordIntent).not.toHaveBeenCalled();
    expect(logAuthError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("context 검증에 실패하면 내부 reason을 외부 상태에 노출하지 않고 이후 검증을 실행하지 않는다", async () => {
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
    expect(createClient).not.toHaveBeenCalled();
    expect(otpVerifyRateLimit.tryStartAttempt).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(applyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("OTP 입력 검증에 실패하면 invalid_input을 반환하고 Verify operation을 시작하지 않는다", async () => {
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
    if (result.status !== "invalid_input") {
      throw new Error("Expected invalid_input state");
    }
    expect(result.fieldErrors?.otp).toBeDefined();
    expect(getTrustedAuthServerActionClientIp).not.toHaveBeenCalled();
    expect(authGlobalRequestRateLimit.tryConsume).not.toHaveBeenCalled();
    expect(otpVerifyRateLimit.tryStartAttempt).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("trusted IP를 확보하지 못하면 fail-closed하고 limiter와 Provider를 호출하지 않는다", async () => {
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
    expect(otpVerifyRateLimit.recordResult).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(logAuthError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.IP_UNAVAILABLE,
      }),
    );
  });

  it("Auth Global 차단은 기존 blocked 상태를 반환하고 client/Verify limiter/Provider를 호출하지 않는다", async () => {
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

  it("Supabase client 준비가 실패하면 limiter와 Provider를 호출하지 않고 outcome도 기록하지 않는다", async () => {
    vi.mocked(createClient).mockRejectedValue(
      new Error("client preparation failed"),
    );

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
    expect(otpVerifyRateLimit.tryStartAttempt).not.toHaveBeenCalled();
    expect(otpVerifyRateLimit.recordResult).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it.each([
    ["email_total", AUTH_LOG_REASONS.OTP_VERIFY_EMAIL_LIMIT],
    ["ip_short", AUTH_LOG_REASONS.OTP_VERIFY_IP_LIMIT],
    ["ip_long", AUTH_LOG_REASONS.OTP_VERIFY_IP_LIMIT],
    ["failure_streak", AUTH_LOG_REASONS.OTP_VERIFY_FAILURE_STREAK],
  ] as const)(
    "%s blocker는 내부 reason으로 기록하고 외부에는 동일한 blocked 상태만 반환한다",
    async (blockedBy, reasonCode) => {
      vi.mocked(otpVerifyRateLimit.tryStartAttempt).mockReturnValue({
        allowed: false,
        blockedBy: blockedBy as OtpVerifyRateLimitBlockedBy,
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
      expect(logAuthEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ reasonCode }),
      );
      expect(verifyOtp).not.toHaveBeenCalled();
      expect(otpVerifyRateLimit.recordResult).not.toHaveBeenCalled();
    },
  );

  it("OTP validity failure만 otp_failure로 기록하고 invalid_otp를 반환한다", async () => {
    vi.mocked(verifyOtp).mockResolvedValue({
      error: createProviderError({
        status: 403,
        code: "otp_expired",
      }),
    } as Awaited<ReturnType<typeof verifyOtp>>);

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
      status: "invalid_otp",
      formError: INVALID_OTP_ERROR_MESSAGE,
    });
    expect(otpVerifyRateLimit.recordResult).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      outcome: "otp_failure",
    });
    expect(createSetPasswordIntent).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("Provider 429는 provider_rate_limited로 기록하고 local blocker와 같은 blocked 외부 상태를 반환한다", async () => {
    vi.mocked(verifyOtp).mockResolvedValue({
      error: createProviderError({
        status: 429,
        code: "over_request_rate_limit",
      }),
    } as Awaited<ReturnType<typeof verifyOtp>>);

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
    expect(otpVerifyRateLimit.recordResult).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      outcome: "provider_rate_limited",
    });
    expect(logAuthEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
      }),
    );
    expect(createSetPasswordIntent).not.toHaveBeenCalled();
  });

  it("unknown Provider error는 provider_error로 기록하고 internal_error를 반환한다", async () => {
    vi.mocked(verifyOtp).mockResolvedValue({
      error: createProviderError({
        status: 500,
        code: "unexpected_error",
      }),
    } as Awaited<ReturnType<typeof verifyOtp>>);

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
    expect(otpVerifyRateLimit.recordResult).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      outcome: "provider_error",
    });
    expect(logAuthError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
      }),
    );
    expect(createSetPasswordIntent).not.toHaveBeenCalled();
  });

  it("Provider 호출이 throw하면 provider_error로 기록하고 internal_error를 반환한다", async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new Error("transport error"));

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
    expect(otpVerifyRateLimit.recordResult).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      outcome: "provider_error",
    });
    expect(logAuthError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
      }),
    );
    expect(createSetPasswordIntent).not.toHaveBeenCalled();
  });

  it("limiter에는 canonical email을 사용하고 Provider에는 context email을 그대로 전달한다", async () => {
    await expect(
      verifyOtpAction(
        null,
        prevState,
        createFormData({
          email: "USER@Example.COM",
          purpose: "signup",
          otp: "123456",
        }),
      ),
    ).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.SET_PASSWORD}`);

    expect(otpVerifyRateLimit.tryStartAttempt).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "user@example.com",
      ip: "127.0.0.1",
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      supabase: mockSupabase,
      email: "USER@Example.COM",
      purpose: "signup",
      otp: "123456",
    });
  });

  it("reset-password OTP 인증에 성공하면 Provider user id로 signed Reset Password Intent를 발급하고 redirect한다", async () => {
    await expect(
      verifyOtpAction(
        null,
        prevState,
        createFormData({
          email: "user@example.com",
          purpose: "reset-password",
          otp: "123456",
        }),
      ),
    ).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.RESET_PASSWORD}`);

    expect(createSignedResetPasswordIntent).toHaveBeenCalledTimes(1);
    expect(createSignedResetPasswordIntent).toHaveBeenCalledWith({
      userId: "verified-user-id",
    });
    expect(createSetPasswordIntent).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(ROUTES.RESET_PASSWORD);

    const recordOrder = vi.mocked(otpVerifyRateLimit.recordResult).mock
      .invocationCallOrder[0]!;
    const completedOrder =
      vi.mocked(logAuthEvent).mock.invocationCallOrder[
        vi
          .mocked(logAuthEvent)
          .mock.calls.findIndex(
            ([event]) => event === AUTH_EVENTS.AUTH_VERIFY_OTP_COMPLETED,
          )
      ]!;
    const issuerOrder = vi.mocked(createSignedResetPasswordIntent).mock
      .invocationCallOrder[0]!;

    expect(recordOrder).toBeLessThan(issuerOrder);
    expect(completedOrder).toBeLessThan(issuerOrder);
  });

  it("client가 userId를 전달해도 Reset Password Intent는 Provider user id만 사용한다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "reset-password",
      otp: "123456",
    });
    formData.set("userId", "client-controlled-user-id");

    await expect(verifyOtpAction(null, prevState, formData)).rejects.toThrow(
      `NEXT_REDIRECT:${ROUTES.RESET_PASSWORD}`,
    );

    expect(createSignedResetPasswordIntent).toHaveBeenCalledWith({
      userId: "verified-user-id",
    });
    expect(createSignedResetPasswordIntent).not.toHaveBeenCalledWith({
      userId: "client-controlled-user-id",
    });
  });

  it("reset-password Verify 응답에 authenticated user가 없으면 success로 기록하지 않고 fail-closed한다", async () => {
    vi.mocked(verifyOtp).mockResolvedValue({
      data: {
        user: null,
      },
      error: null,
    } as Awaited<ReturnType<typeof verifyOtp>>);

    const result = await verifyOtpAction(
      null,
      prevState,
      createFormData({
        email: "user@example.com",
        purpose: "reset-password",
        otp: "123456",
      }),
    );

    expect(result).toEqual({
      status: "internal_error",
      fieldErrors: null,
    });
    expect(otpVerifyRateLimit.recordResult).not.toHaveBeenCalled();
    expect(logAuthEvent).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_COMPLETED,
      expect.anything(),
    );
    expect(createSignedResetPasswordIntent).not.toHaveBeenCalled();
    expect(createSetPasswordIntent).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("reset-password 성공 후 signed Intent 발급이 실패하면 Verify 성공 결과를 유지한다", async () => {
    vi.mocked(createSignedResetPasswordIntent).mockRejectedValue(
      new Error("signed reset intent failed"),
    );

    const result = await verifyOtpAction(
      null,
      prevState,
      createFormData({
        email: "user@example.com",
        purpose: "reset-password",
        otp: "123456",
      }),
    );

    expect(result).toEqual({
      status: "internal_error",
      fieldErrors: null,
    });

    expect(otpVerifyRateLimit.recordResult).toHaveBeenCalledTimes(1);
    expect(otpVerifyRateLimit.recordResult).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      outcome: "success",
    });
    expect(logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_COMPLETED,
      expect.anything(),
    );

    expect(createSignedResetPasswordIntent).toHaveBeenCalledTimes(1);
    expect(createSignedResetPasswordIntent).toHaveBeenCalledWith({
      userId: "verified-user-id",
    });
    expect(createSetPasswordIntent).not.toHaveBeenCalled();

    const recordOrder = vi.mocked(otpVerifyRateLimit.recordResult).mock
      .invocationCallOrder[0]!;
    const completedOrder =
      vi.mocked(logAuthEvent).mock.invocationCallOrder[
        vi
          .mocked(logAuthEvent)
          .mock.calls.findIndex(
            ([event]) => event === AUTH_EVENTS.AUTH_VERIFY_OTP_COMPLETED,
          )
      ]!;
    const issuerOrder = vi.mocked(createSignedResetPasswordIntent).mock
      .invocationCallOrder[0]!;

    expect(recordOrder).toBeLessThan(issuerOrder);
    expect(completedOrder).toBeLessThan(issuerOrder);

    expect(logAuthError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("reset-password 성공 시 redirectPath를 유지한다", async () => {
    const redirectPath = "/notes";
    const expectedPath = `${ROUTES.RESET_PASSWORD}?redirect=${encodeURIComponent(
      redirectPath,
    )}`;

    await expect(
      verifyOtpAction(
        redirectPath,
        prevState,
        createFormData({
          email: "user@example.com",
          purpose: "reset-password",
          otp: "123456",
        }),
      ),
    ).rejects.toThrow(`NEXT_REDIRECT:${expectedPath}`);

    expect(redirect).toHaveBeenCalledWith(expectedPath);
    expect(createSignedResetPasswordIntent).toHaveBeenCalledTimes(1);
    expect(createSignedResetPasswordIntent).toHaveBeenCalledWith({
      userId: "verified-user-id",
    });
    expect(createSetPasswordIntent).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "OTP validity failure",
      setup: () =>
        vi.mocked(verifyOtp).mockResolvedValue({
          error: createProviderError({
            status: 403,
            code: "otp_expired",
          }),
        } as Awaited<ReturnType<typeof verifyOtp>>),
      expectedState: {
        status: "invalid_otp",
        formError: INVALID_OTP_ERROR_MESSAGE,
      },
      expectedOutcome: "otp_failure",
    },
    {
      name: "Provider 429",
      setup: () =>
        vi.mocked(verifyOtp).mockResolvedValue({
          error: createProviderError({
            status: 429,
            code: "over_request_rate_limit",
          }),
        } as Awaited<ReturnType<typeof verifyOtp>>),
      expectedState: {
        status: "blocked",
        fieldErrors: null,
      },
      expectedOutcome: "provider_rate_limited",
    },
    {
      name: "unknown Provider error",
      setup: () =>
        vi.mocked(verifyOtp).mockResolvedValue({
          error: createProviderError({
            status: 500,
            code: "unexpected_error",
          }),
        } as Awaited<ReturnType<typeof verifyOtp>>),
      expectedState: {
        status: "internal_error",
        fieldErrors: null,
      },
      expectedOutcome: "provider_error",
    },
    {
      name: "Provider throw",
      setup: () =>
        vi.mocked(verifyOtp).mockRejectedValue(new Error("transport error")),
      expectedState: {
        status: "internal_error",
        fieldErrors: null,
      },
      expectedOutcome: "provider_error",
    },
  ])(
    "reset-password $name에서는 signed Reset Password Intent를 발급하지 않는다",
    async ({ setup, expectedState, expectedOutcome }) => {
      setup();

      const result = await verifyOtpAction(
        null,
        prevState,
        createFormData({
          email: "user@example.com",
          purpose: "reset-password",
          otp: "123456",
        }),
      );

      expect(result).toEqual(expectedState);
      expect(otpVerifyRateLimit.recordResult).toHaveBeenCalledWith({
        canonicalEmail: "user@example.com",
        outcome: expectedOutcome,
      });
      expect(createSignedResetPasswordIntent).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    },
  );
});
