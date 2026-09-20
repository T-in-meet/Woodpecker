import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";
import {
  clearSupabaseAuthSessionCookies,
  createClient,
} from "@/lib/supabase/server";

import { AUTH_EVENTS } from "../../constants/authEvents";
import { AUTH_LOG_REASONS } from "../../constants/authLogReasons";
import { AUTH_PROVIDER_TIMEOUT_MS } from "../../constants/authProviderTimeout";
import { INVALID_OTP_ERROR_MESSAGE } from "../../constants/otp";
import { applyMinimumActionDelay } from "../../lib/applyMinimumActionDelay";
import { logAuthError, logAuthEvent } from "../../lib/authLogger";
import { createAuthProviderTimeoutContext } from "../../lib/authProviderTimeout";
import { authGlobalRequestRateLimit } from "../../lib/rate-limit/authGlobalRequestRateLimit";
import { otpVerifyRateLimit } from "../../lib/rate-limit/otpVerifyRateLimit";
import { getTrustedAuthServerActionClientIp } from "../../lib/rate-limit/trustedAuthClientIp";
import { createSetPasswordIntent } from "../../lib/setPasswordIntent";
import { createSignedResetPasswordIntent } from "../../lib/signedResetPasswordIntent";
import { validateRedirectPath } from "../../lib/validateRedirectPath";
import { verifyOtp } from "../lib/verifyOtp";
import { verifyOtpAction } from "./verifyOtpAction";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  clearSupabaseAuthSessionCookies: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("../../lib/authLogger", () => ({
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
  normalizeUnknownError: vi.fn((error: unknown) =>
    error instanceof Error
      ? {
          errorMessage: error.message,
          errorName: error.name,
        }
      : {
          errorMessage: String(error),
          errorName: "UnknownError",
        },
  ),
}));

vi.mock("../../lib/authProviderTimeout", () => ({
  createAuthProviderTimeoutContext: vi.fn(),
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

vi.mock("../../lib/validateRedirectPath", () => ({
  validateRedirectPath: vi.fn(),
}));

vi.mock("../../lib/applyMinimumActionDelay", () => ({
  applyMinimumActionDelay: vi.fn(),
}));

import { redirect } from "next/navigation";

const prevState = {
  status: "idle",
  fieldErrors: null,
} as const;

const verifySupabase = {
  auth: {
    verifyOtp: vi.fn(),
    signOut: vi.fn(),
  },
} as never;

const compensationSignOut = vi.fn();

const compensationSupabase = {
  auth: {
    signOut: compensationSignOut,
  },
} as never;

const verifyProviderFetch = vi.fn() as unknown as typeof fetch;
const compensationProviderFetch = vi.fn() as unknown as typeof fetch;
const verifyProviderSettle = vi.fn();
const compensationProviderSettle = vi.fn();

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

function expectOtpSuccessMilestone() {
  expect(otpVerifyRateLimit.recordResult).toHaveBeenCalledTimes(1);
  expect(otpVerifyRateLimit.recordResult).toHaveBeenCalledWith({
    canonicalEmail: "user@example.com",
    outcome: "success",
  });
  expect(logAuthEvent).toHaveBeenCalledWith(
    AUTH_EVENTS.AUTH_VERIFY_OTP_COMPLETED,
    expect.objectContaining({
      result: "success",
    }),
  );
}

function expectNoSessionCompensation() {
  expect(compensationSignOut).not.toHaveBeenCalled();
  expect(clearSupabaseAuthSessionCookies).not.toHaveBeenCalled();
  expect(compensationProviderSettle).not.toHaveBeenCalled();
}

describe("verifyOtpAction session compensation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createAuthProviderTimeoutContext).mockReset();
    vi.mocked(createClient).mockReset();
    compensationSignOut.mockReset();

    vi.mocked(getTrustedAuthServerActionClientIp).mockResolvedValue({
      available: true,
      ip: "127.0.0.1",
    });

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

    vi.mocked(validateRedirectPath).mockImplementation((value: unknown) =>
      typeof value === "string" && value.startsWith("/")
        ? value
        : ROUTES.MYPAGE,
    );

    vi.mocked(createSetPasswordIntent).mockResolvedValue(undefined);
    vi.mocked(createSignedResetPasswordIntent).mockResolvedValue(undefined);
    vi.mocked(clearSupabaseAuthSessionCookies).mockResolvedValue(undefined);
    vi.mocked(applyMinimumActionDelay).mockResolvedValue(undefined);

    compensationSignOut.mockResolvedValue({
      error: null,
    });

    vi.mocked(createAuthProviderTimeoutContext)
      .mockImplementationOnce(() => ({
        fetch: verifyProviderFetch,
        didTimeout: () => false,
        settle: verifyProviderSettle,
      }))
      .mockImplementation(() => ({
        fetch: compensationProviderFetch,
        didTimeout: () => false,
        settle: compensationProviderSettle,
      }));

    vi.mocked(createClient)
      .mockResolvedValueOnce(verifySupabase)
      .mockResolvedValue(compensationSupabase);
  });

  it("signup Intent 발급 실패 시 OTP success를 유지하고 current-session compensation을 수행한다", async () => {
    vi.mocked(createSetPasswordIntent).mockRejectedValue(
      new Error("set password intent failed"),
    );

    const result = await verifyOtpAction(
      "/notes",
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

    expectOtpSuccessMilestone();

    expect(createSetPasswordIntent).toHaveBeenCalledWith({
      userId: "verified-user-id",
      redirectPath: "/notes",
    });
    expect(createSignedResetPasswordIntent).not.toHaveBeenCalled();

    expect(createClient).toHaveBeenCalledTimes(2);
    expect(compensationSignOut).toHaveBeenCalledTimes(1);
    expect(compensationSignOut).toHaveBeenCalledWith({
      scope: "local",
    });
    expect(clearSupabaseAuthSessionCookies).toHaveBeenCalledTimes(1);
    expect(compensationProviderSettle).toHaveBeenCalledTimes(1);

    expect(logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        errorMessage: "set password intent failed",
      }),
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("reset-password Intent 발급 실패에도 동일한 current-session compensation을 적용한다", async () => {
    vi.mocked(createSignedResetPasswordIntent).mockRejectedValue(
      new Error("reset password intent failed"),
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

    expectOtpSuccessMilestone();

    expect(createSignedResetPasswordIntent).toHaveBeenCalledWith({
      userId: "verified-user-id",
    });
    expect(createSetPasswordIntent).not.toHaveBeenCalled();

    expect(createClient).toHaveBeenCalledTimes(2);
    expect(compensationSignOut).toHaveBeenCalledTimes(1);
    expect(compensationSignOut).toHaveBeenCalledWith({
      scope: "local",
    });
    expect(clearSupabaseAuthSessionCookies).toHaveBeenCalledTimes(1);
    expect(compensationProviderSettle).toHaveBeenCalledTimes(1);

    expect(logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        errorMessage: "reset password intent failed",
      }),
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("compensation은 Verify용 timeout context를 재사용하지 않고 fresh context/client를 사용한다", async () => {
    vi.mocked(createSetPasswordIntent).mockRejectedValue(
      new Error("set password intent failed"),
    );

    await verifyOtpAction(
      "/notes",
      prevState,
      createFormData({
        email: "user@example.com",
        purpose: "signup",
        otp: "123456",
      }),
    );

    expect(createAuthProviderTimeoutContext).toHaveBeenCalledTimes(2);
    expect(createAuthProviderTimeoutContext).toHaveBeenNthCalledWith(1, {
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });
    expect(createAuthProviderTimeoutContext).toHaveBeenNthCalledWith(2, {
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    expect(createClient).toHaveBeenCalledTimes(2);

    const verifyOptions = vi.mocked(createClient).mock.calls[0]?.[0] as
      | { fetch?: typeof fetch }
      | undefined;
    const compensationOptions = vi.mocked(createClient).mock.calls[1]?.[0] as
      | { fetch?: typeof fetch }
      | undefined;

    expect(verifyOptions?.fetch).toBe(verifyProviderFetch);
    expect(compensationOptions?.fetch).toBe(compensationProviderFetch);
    expect(compensationOptions?.fetch).not.toBe(verifyOptions?.fetch);

    expect(verifyProviderSettle).toHaveBeenCalledTimes(1);
    expect(compensationProviderSettle).toHaveBeenCalledTimes(1);
  });

  it("local signOut 성공 시 compensation timeout context를 정확히 1회 settle한다", async () => {
    vi.mocked(createSetPasswordIntent).mockRejectedValue(
      new Error("set password intent failed"),
    );

    await verifyOtpAction(
      "/notes",
      prevState,
      createFormData({
        email: "user@example.com",
        purpose: "signup",
        otp: "123456",
      }),
    );

    expect(compensationSignOut).toHaveBeenCalledWith({
      scope: "local",
    });
    expect(compensationProviderSettle).toHaveBeenCalledTimes(1);
    expect(clearSupabaseAuthSessionCookies).toHaveBeenCalledTimes(1);
  });

  it("local signOut이 error를 반환해도 compensation timeout context를 정확히 1회 settle한다", async () => {
    vi.mocked(createSetPasswordIntent).mockRejectedValue(
      new Error("set password intent failed"),
    );
    compensationSignOut.mockResolvedValue({
      error: new Error("local signout failed"),
    });

    await verifyOtpAction(
      "/notes",
      prevState,
      createFormData({
        email: "user@example.com",
        purpose: "signup",
        otp: "123456",
      }),
    );

    expect(compensationProviderSettle).toHaveBeenCalledTimes(1);
    expect(clearSupabaseAuthSessionCookies).toHaveBeenCalledTimes(1);
  });

  it("local signOut이 throw/reject해도 compensation timeout context를 정확히 1회 settle한다", async () => {
    vi.mocked(createSetPasswordIntent).mockRejectedValue(
      new Error("set password intent failed"),
    );
    compensationSignOut.mockRejectedValue(
      new Error("local signout transport failed"),
    );

    await verifyOtpAction(
      "/notes",
      prevState,
      createFormData({
        email: "user@example.com",
        purpose: "signup",
        otp: "123456",
      }),
    );

    expect(compensationProviderSettle).toHaveBeenCalledTimes(1);
    expect(clearSupabaseAuthSessionCookies).toHaveBeenCalledTimes(1);
  });

  it("cookie clear가 실패해도 Provider operation 종료 후 compensation timeout context는 settle된다", async () => {
    vi.mocked(createSetPasswordIntent).mockRejectedValue(
      new Error("set password intent failed"),
    );
    vi.mocked(clearSupabaseAuthSessionCookies).mockRejectedValue(
      new Error("cookie clear failed"),
    );

    await verifyOtpAction(
      "/notes",
      prevState,
      createFormData({
        email: "user@example.com",
        purpose: "signup",
        otp: "123456",
      }),
    );

    expect(compensationProviderSettle).toHaveBeenCalledTimes(1);
    expect(clearSupabaseAuthSessionCookies).toHaveBeenCalledTimes(1);
  });

  it("local signOut 실패 후 cookie clear가 성공하면 current-browser recovery를 완료하고 원래 Intent 오류를 유지한다", async () => {
    vi.mocked(createSetPasswordIntent).mockRejectedValue(
      new Error("set password intent failed"),
    );
    compensationSignOut.mockResolvedValue({
      error: new Error("local signout failed"),
    });

    const result = await verifyOtpAction(
      "/notes",
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

    expect(compensationSignOut).toHaveBeenCalledWith({
      scope: "local",
    });
    expect(clearSupabaseAuthSessionCookies).toHaveBeenCalledTimes(1);

    expect(logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        errorMessage: "set password intent failed",
      }),
    );

    expect(logAuthError).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED,
      expect.objectContaining({
        reasonCode: "AUTH_SESSION_COMPENSATION_FAILED",
      }),
    );
  });

  it("local signOut 성공 후 cookie clear가 실패해도 원래 Intent 오류를 덮어쓰지 않는다", async () => {
    vi.mocked(createSetPasswordIntent).mockRejectedValue(
      new Error("set password intent failed"),
    );
    vi.mocked(clearSupabaseAuthSessionCookies).mockRejectedValue(
      new Error("cookie clear failed"),
    );

    const result = await verifyOtpAction(
      "/notes",
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

    expect(compensationSignOut).toHaveBeenCalledWith({
      scope: "local",
    });
    expect(clearSupabaseAuthSessionCookies).toHaveBeenCalledTimes(1);

    expect(logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        errorMessage: "set password intent failed",
      }),
    );

    expect(logAuthError).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED,
      expect.objectContaining({
        reasonCode: "AUTH_SESSION_COMPENSATION_FAILED",
      }),
    );
  });

  it("local signOut과 cookie clear가 모두 실패하면 원래 Intent 오류를 보존하고 compensation 실패를 추가 기록한다", async () => {
    vi.mocked(createSetPasswordIntent).mockRejectedValue(
      new Error("set password intent failed"),
    );
    compensationSignOut.mockResolvedValue({
      error: new Error("local signout failed"),
    });
    vi.mocked(clearSupabaseAuthSessionCookies).mockRejectedValue(
      new Error("cookie clear failed"),
    );

    const result = await verifyOtpAction(
      "/notes",
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

    expect(logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        errorMessage: "set password intent failed",
      }),
    );

    expect(logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED,
      expect.objectContaining({
        reasonCode: "AUTH_SESSION_COMPENSATION_FAILED",
      }),
    );

    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    ["signup", ROUTES.SET_PASSWORD],
    ["reset-password", ROUTES.RESET_PASSWORD],
  ] as const)(
    "정상 %s Intent 발급 성공 경로에서는 compensation을 실행하지 않는다",
    async (purpose, expectedPath) => {
      await expect(
        verifyOtpAction(
          null,
          prevState,
          createFormData({
            email: "user@example.com",
            purpose,
            otp: "123456",
          }),
        ),
      ).rejects.toThrow(`NEXT_REDIRECT:${expectedPath}`);

      expect(createAuthProviderTimeoutContext).toHaveBeenCalledTimes(1);
      expect(createClient).toHaveBeenCalledTimes(1);
      expectNoSessionCompensation();
    },
  );

  it("OTP validity failure에서는 compensation을 실행하지 않는다", async () => {
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
    expect(createAuthProviderTimeoutContext).toHaveBeenCalledTimes(1);
    expectNoSessionCompensation();
  });

  it("Provider failure에서는 compensation을 실행하지 않는다", async () => {
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
    expect(createAuthProviderTimeoutContext).toHaveBeenCalledTimes(1);
    expectNoSessionCompensation();
  });

  it("Verify Rate Limit blocked에서는 compensation을 실행하지 않는다", async () => {
    vi.mocked(otpVerifyRateLimit.tryStartAttempt).mockReturnValue({
      allowed: false,
      blockedBy: "email_total",
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
    expect(createAuthProviderTimeoutContext).toHaveBeenCalledTimes(1);
    expectNoSessionCompensation();
  });

  it("Auth Global Rate Limit blocked에서는 Provider/compensation을 시작하지 않는다", async () => {
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

    expect(createAuthProviderTimeoutContext).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expectNoSessionCompensation();

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
