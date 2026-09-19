/**
 * 로그인 API Rate Limit / Provider 경계 테스트.
 *
 * 검증 범위:
 * - Auth Global / Local Rate Limit 차단 시 Provider 미호출
 * - IP_UNAVAILABLE / Provider client 준비 실패 시 attempt 미소비
 * - Local Rate Limit과 Provider 429의 외부 계약 동일성
 * - Provider 호출 직전 check+consume 순서
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { authGlobalRequestRateLimit } from "@/features/auth/lib/rate-limit/authGlobalRequestRateLimit";
import { getTrustedAuthClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";
import { loginRateLimit } from "@/features/auth/login/lib/loginRateLimit";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";
import {
  DEFAULT_LOGIN_BODY,
  makeLoginRequest,
  mockLoginSuccess,
  mockSignIn,
  resetLoginApiMocks,
  setupLoginApiMocks,
  setupLoginSecurityMocks,
} from "./utils/loginTestHelper";

const getLegalAcceptanceStatusMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/lib/rate-limit/authGlobalRequestRateLimit", () => ({
  authGlobalRequestRateLimit: {
    tryConsume: vi.fn(),
  },
}));
vi.mock("@/features/auth/lib/rate-limit/trustedAuthClientIp", () => ({
  getTrustedAuthClientIp: vi.fn(),
}));
vi.mock("@/features/auth/lib/userAgreements", () => ({
  getLegalAcceptanceStatus: getLegalAcceptanceStatusMock,
}));
vi.mock("@/features/auth/login/lib/loginRateLimit", () => ({
  loginRateLimit: {
    tryStartAttempt: vi.fn(),
    recordResult: vi.fn(),
  },
}));
vi.mock("@/lib/supabase/server");

describe("로그인 API Rate Limit 처리", () => {
  beforeEach(() => {
    resetLoginApiMocks();
    setupLoginApiMocks();
    setupLoginSecurityMocks();
    mockLoginSuccess();
    getLegalAcceptanceStatusMock.mockResolvedValue({ canAccessService: true });
    vi.mocked(authGlobalRequestRateLimit.tryConsume).mockClear();
    vi.mocked(authGlobalRequestRateLimit.tryConsume).mockReturnValue({
      allowed: true,
    });
  });

  it("Auth Global 차단은 malformed body보다 먼저 429로 종료하고 downstream을 호출하지 않는다", async () => {
    vi.mocked(authGlobalRequestRateLimit.tryConsume).mockReturnValue({
      allowed: false,
      blockedBy: "ip_short",
    });

    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: "{malformed",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED);
    expect(createClient).not.toHaveBeenCalled();
    expect(loginRateLimit.tryStartAttempt).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it.each(["email_attempt", "ip_short", "ip_long", "failure_streak"] as const)(
    "Local Rate Limit %s 차단 시 429를 반환하고 Provider를 호출하지 않는다",
    async (blockedBy) => {
      vi.mocked(loginRateLimit.tryStartAttempt).mockReturnValue({
        allowed: false,
        blockedBy,
      });

      const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.code).toBe(AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED);
      expect(mockSignIn).not.toHaveBeenCalled();
      expect(loginRateLimit.recordResult).not.toHaveBeenCalled();
    },
  );

  it("trusted IP를 확보하지 못하면 generic 500을 반환하고 Global/attempt/Provider를 시작하지 않는다", async () => {
    vi.mocked(getTrustedAuthClientIp).mockReturnValue({
      available: false,
      reasonCode: AUTH_LOG_REASONS.IP_UNAVAILABLE,
    });

    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_INTERNAL_ERROR);
    expect(authGlobalRequestRateLimit.tryConsume).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(loginRateLimit.tryStartAttempt).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("Provider client 준비가 실패하면 Login attempt를 소비하지 않는다", async () => {
    vi.mocked(createClient).mockRejectedValue(
      new Error("supabase client init failed"),
    );

    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_INTERNAL_ERROR);
    expect(loginRateLimit.tryStartAttempt).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("Rate Limit identity에는 canonicalEmail과 trusted IP를 전달한다", async () => {
    vi.mocked(getTrustedAuthClientIp).mockReturnValue({
      available: true,
      ip: "203.0.113.10",
    });

    await POST(
      makeLoginRequest({
        email: "User@Example.COM",
        password: "Password123!",
      }),
    );

    expect(authGlobalRequestRateLimit.tryConsume).toHaveBeenCalledWith({
      ip: "203.0.113.10",
    });
    expect(loginRateLimit.tryStartAttempt).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      ip: "203.0.113.10",
    });
  });

  it("Provider client 준비 → atomic check+consume → signInWithPassword 순서를 지킨다", async () => {
    await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));

    const createClientOrder =
      vi.mocked(createClient).mock.invocationCallOrder[0];
    const tryStartOrder = vi.mocked(loginRateLimit.tryStartAttempt).mock
      .invocationCallOrder[0];
    const signInOrder = mockSignIn.mock.invocationCallOrder[0];

    expect(createClientOrder).toBeDefined();
    expect(tryStartOrder).toBeDefined();
    expect(signInOrder).toBeDefined();
    expect(createClientOrder!).toBeLessThan(tryStartOrder!);
    expect(tryStartOrder!).toBeLessThan(signInOrder!);
  });

  it("Provider 429는 Local Rate Limit과 동일한 외부 응답 계약을 사용한다", async () => {
    vi.mocked(loginRateLimit.tryStartAttempt).mockReturnValueOnce({
      allowed: false,
      blockedBy: "email_attempt",
    });

    const localResponse = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const localBody = await localResponse.json();

    vi.mocked(loginRateLimit.tryStartAttempt).mockReturnValue({
      allowed: true,
    });
    mockSignIn.mockResolvedValue({
      data: null,
      error: {
        name: "AuthApiError",
        message: "rate limited",
        status: 429,
        code: "over_request_rate_limit",
      },
    });

    const providerResponse = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const providerBody = await providerResponse.json();

    expect(providerResponse.status).toBe(localResponse.status);
    expect(providerBody).toEqual(localBody);
    expect(loginRateLimit.recordResult).toHaveBeenLastCalledWith({
      canonicalEmail: "user@example.com",
      result: "non_credential_failure",
    });
  });
});
