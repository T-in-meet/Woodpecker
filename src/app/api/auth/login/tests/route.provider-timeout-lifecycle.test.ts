import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logAuthError } from "@/features/auth/lib/authLogger";
import { createAuthProviderTimeoutContext } from "@/features/auth/lib/authProviderTimeout";
import { authGlobalRequestRateLimit } from "@/features/auth/lib/rate-limit/authGlobalRequestRateLimit";
import { getTrustedAuthClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";
import { getLegalAcceptanceStatus } from "@/features/auth/lib/userAgreements";
import { loginRateLimit } from "@/features/auth/login/lib/loginRateLimit";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";

vi.mock("@/features/auth/lib/applyMinimumResponseTime", () => ({
  applyMinimumResponseTime: vi.fn(
    async (_start: number, response: Response) => response,
  ),
}));

vi.mock("@/features/auth/lib/authLogger", () => ({
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
  normalizeUnknownError: vi.fn((error: unknown) =>
    error instanceof Error
      ? { errorMessage: error.message, errorName: error.name }
      : { errorMessage: String(error), errorName: "UnknownError" },
  ),
}));

vi.mock("@/features/auth/lib/authProviderTimeout", () => ({
  createAuthProviderTimeoutContext: vi.fn(),
}));

vi.mock("@/features/auth/lib/rate-limit/authGlobalRequestRateLimit", () => ({
  authGlobalRequestRateLimit: {
    tryConsume: vi.fn(),
  },
}));

vi.mock("@/features/auth/lib/rate-limit/trustedAuthClientIp", () => ({
  getTrustedAuthClientIp: vi.fn(),
}));

vi.mock("@/features/auth/lib/userAgreements", () => ({
  getLegalAcceptanceStatus: vi.fn(),
}));

vi.mock("@/features/auth/login/lib/loginRateLimit", () => ({
  loginRateLimit: {
    tryStartAttempt: vi.fn(),
    recordResult: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const signInWithPasswordMock = vi.fn();
const providerFetchMock = vi.fn();
const didTimeoutMock = vi.fn(() => false);
const settleMock = vi.fn();
const disposeMock = vi.fn();

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
    if (signInWithPasswordMock.mock.calls.length > 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("signInWithPassword was not invoked");
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

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "user@example.com",
      password: "Password123!",
    }),
  });
}

describe("Login Provider timeout context lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getTrustedAuthClientIp).mockReturnValue({
      available: true,
      ip: "127.0.0.1",
    });
    vi.mocked(authGlobalRequestRateLimit.tryConsume).mockReturnValue({
      allowed: true,
    });
    vi.mocked(loginRateLimit.tryStartAttempt).mockReturnValue({
      allowed: true,
    });
    vi.mocked(loginRateLimit.recordResult).mockReturnValue(undefined);
    vi.mocked(getLegalAcceptanceStatus).mockResolvedValue({
      canAccessService: true,
    } as never);

    vi.mocked(createAuthProviderTimeoutContext).mockReturnValue({
      fetch: providerFetchMock,
      didTimeout: didTimeoutMock,
      settle: settleMock,
      dispose: disposeMock,
    } as never);

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
      },
    } as never);
  });

  it("signInWithPassword Promise가 resolve되기 전에는 lifecycle을 종료하지 않고 resolve 직후 종료한다", async () => {
    const deferred = createDeferred<{
      data: null;
      error: {
        name: string;
        message: string;
        status: number;
      };
    }>();
    signInWithPasswordMock.mockReturnValue(deferred.promise);

    const requestPromise = POST(makeRequest());

    await waitForProviderInvocation();

    expect(lifecycleInvocationOrders()).toHaveLength(0);

    deferred.resolve({
      data: null,
      error: {
        name: "AuthRetryableFetchError",
        message: "network failed",
        status: 0,
      },
    });

    await requestPromise;

    expectSingleLifecycleEndBeforeDidTimeout();
    expect(logAuthError).toHaveBeenCalledTimes(1);
  });

  it("signInWithPassword 정상 성공 Promise도 resolve 전에는 lifecycle을 종료하지 않고 후속 agreement 조회 전에 종료한다", async () => {
    const deferred = createDeferred<{
      data: {
        user: { id: string };
        session: null;
      };
      error: null;
    }>();
    signInWithPasswordMock.mockReturnValue(deferred.promise);

    const requestPromise = POST(makeRequest());

    await waitForProviderInvocation();

    expect(lifecycleInvocationOrders()).toHaveLength(0);
    expect(getLegalAcceptanceStatus).not.toHaveBeenCalled();

    deferred.resolve({
      data: {
        user: { id: "user-id" },
        session: null,
      },
      error: null,
    });

    await requestPromise;

    const lifecycleOrders = lifecycleInvocationOrders();
    expect(lifecycleOrders).toHaveLength(1);
    expect(getLegalAcceptanceStatus).toHaveBeenCalledTimes(1);
    expect(lifecycleOrders[0]!).toBeLessThan(
      vi.mocked(getLegalAcceptanceStatus).mock.invocationCallOrder[0]!,
    );
  });

  it("signInWithPassword Promise가 reject되기 전에는 lifecycle을 종료하지 않고 reject 직후 종료한다", async () => {
    const deferred = createDeferred<never>();
    signInWithPasswordMock.mockReturnValue(deferred.promise);

    const requestPromise = POST(makeRequest());

    await waitForProviderInvocation();

    expect(lifecycleInvocationOrders()).toHaveLength(0);

    deferred.reject(new Error("provider transport failed"));

    await requestPromise;

    expectSingleLifecycleEndBeforeDidTimeout();
    expect(logAuthError).toHaveBeenCalledTimes(1);
  });
});
