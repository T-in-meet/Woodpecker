import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { applyMinimumActionDelay } from "../../lib/applyMinimumActionDelay";
import { logAuthError } from "../../lib/authLogger";
import { createAuthProviderTimeoutContext } from "../../lib/authProviderTimeout";
import { authGlobalRequestRateLimit } from "../../lib/rate-limit/authGlobalRequestRateLimit";
import { otpVerifyRateLimit } from "../../lib/rate-limit/otpVerifyRateLimit";
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

vi.mock("../../lib/applyMinimumActionDelay", () => ({
  applyMinimumActionDelay: vi.fn(),
}));

vi.mock("../../lib/authLogger", () => ({
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
  normalizeUnknownError: vi.fn((error: unknown) =>
    error instanceof Error
      ? { errorMessage: error.message, errorName: error.name }
      : { errorMessage: String(error), errorName: "UnknownError" },
  ),
}));

vi.mock("../../lib/authProviderTimeout", () => ({
  createAuthProviderTimeoutContext: vi.fn(),
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

vi.mock("../../lib/rate-limit/trustedAuthClientIp", () => ({
  getTrustedAuthServerActionClientIp: vi.fn(),
}));

vi.mock("../../lib/setPasswordIntent", () => ({
  createSetPasswordIntent: vi.fn(),
}));

vi.mock("../../lib/signedResetPasswordIntent", () => ({
  createSignedResetPasswordIntent: vi.fn(),
}));

vi.mock("../lib/verifyOtp", () => ({
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const providerFetchMock = vi.fn();
const didTimeoutMock = vi.fn(() => false);
const settleMock = vi.fn();
const disposeMock = vi.fn();
const mockSupabase = { auth: { verifyOtp: vi.fn() } } as never;

const prevState = {
  status: "idle",
  fieldErrors: null,
} as const;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

async function waitForProviderInvocation(): Promise<void> {
  for (let index = 0; index < 50; index += 1) {
    if (vi.mocked(verifyOtp).mock.calls.length > 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("verifyOtp was not invoked");
}

function lifecycleInvocationOrders(): number[] {
  return [
    ...settleMock.mock.invocationCallOrder,
    ...disposeMock.mock.invocationCallOrder,
  ];
}

function expectSingleLifecycleEndBeforeDidTimeout(): void {
  const lifecycleOrders = lifecycleInvocationOrders();

  expect(lifecycleOrders).toHaveLength(1);
  expect(didTimeoutMock).toHaveBeenCalled();
  expect(lifecycleOrders[0]!).toBeLessThan(
    didTimeoutMock.mock.invocationCallOrder[0]!,
  );
}

function createFormData(): FormData {
  const formData = new FormData();
  formData.set("email", "user@example.com");
  formData.set("purpose", "signup");
  formData.set("otp", "123456");
  return formData;
}

describe("OTP Verify Provider timeout context lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
    vi.mocked(otpVerifyRateLimit.recordResult).mockReturnValue(undefined);
    vi.mocked(applyMinimumActionDelay).mockResolvedValue(undefined);
    vi.mocked(createSetPasswordIntent).mockResolvedValue(undefined);
    vi.mocked(createSignedResetPasswordIntent).mockResolvedValue(undefined);

    vi.mocked(createAuthProviderTimeoutContext).mockReturnValue({
      fetch: providerFetchMock,
      didTimeout: didTimeoutMock,
      settle: settleMock,
      dispose: disposeMock,
    } as never);

    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

  it("verifyOtp Promise가 resolve되기 전에는 lifecycle을 종료하지 않고 resolve 직후 종료한다", async () => {
    const deferred = createDeferred<Awaited<ReturnType<typeof verifyOtp>>>();
    vi.mocked(verifyOtp).mockReturnValue(deferred.promise);

    const actionPromise = verifyOtpAction(null, prevState, createFormData());

    await waitForProviderInvocation();

    expect(lifecycleInvocationOrders()).toHaveLength(0);

    deferred.resolve({
      data: { user: null },
      error: {
        name: "AuthRetryableFetchError",
        message: "network failed",
        status: 0,
      },
    } as Awaited<ReturnType<typeof verifyOtp>>);

    const result = await actionPromise;

    expect(result).toEqual({
      status: "internal_error",
      fieldErrors: null,
    });
    expectSingleLifecycleEndBeforeDidTimeout();
    expect(logAuthError).toHaveBeenCalledTimes(1);
  });

  it("verifyOtp 정상 성공 Promise도 resolve 전에는 lifecycle을 종료하지 않고 Set Password Intent 생성 전에 종료한다", async () => {
    const deferred = createDeferred<Awaited<ReturnType<typeof verifyOtp>>>();
    vi.mocked(verifyOtp).mockReturnValue(deferred.promise);

    const actionPromise = verifyOtpAction(null, prevState, createFormData());

    await waitForProviderInvocation();

    expect(lifecycleInvocationOrders()).toHaveLength(0);
    expect(createSetPasswordIntent).not.toHaveBeenCalled();

    deferred.resolve({
      data: {
        user: { id: "verified-user-id" },
      },
      error: null,
    } as Awaited<ReturnType<typeof verifyOtp>>);

    await expect(actionPromise).rejects.toThrow("NEXT_REDIRECT:");

    const lifecycleOrders = lifecycleInvocationOrders();
    expect(lifecycleOrders).toHaveLength(1);
    expect(createSetPasswordIntent).toHaveBeenCalledTimes(1);
    expect(lifecycleOrders[0]!).toBeLessThan(
      vi.mocked(createSetPasswordIntent).mock.invocationCallOrder[0]!,
    );
  });

  it("verifyOtp Promise가 reject되기 전에는 lifecycle을 종료하지 않고 reject 직후 종료한다", async () => {
    const deferred = createDeferred<Awaited<ReturnType<typeof verifyOtp>>>();
    vi.mocked(verifyOtp).mockReturnValue(deferred.promise);

    const actionPromise = verifyOtpAction(null, prevState, createFormData());

    await waitForProviderInvocation();

    expect(lifecycleInvocationOrders()).toHaveLength(0);

    deferred.reject(new Error("verify transport failed"));

    const result = await actionPromise;

    expect(result).toEqual({
      status: "internal_error",
      fieldErrors: null,
    });
    expectSingleLifecycleEndBeforeDidTimeout();
    expect(logAuthError).toHaveBeenCalledTimes(1);
  });
});
