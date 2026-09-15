/**
 * 로그인 API Provider 결과 분류 전용 테스트.
 *
 * 명확히 allowlist된 invalid_credentials만 credential failure로 처리하고,
 * Provider 429/system/unknown/throw는 credential streak에 포함하지 않는다.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { loginRateLimit } from "@/features/auth/login/lib/loginRateLimit";

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

describe("로그인 API Provider 결과 분류", () => {
  beforeEach(() => {
    resetLoginApiMocks();
    setupLoginApiMocks();
    setupLoginSecurityMocks();
    mockLoginSuccess();
    getLegalAcceptanceStatusMock.mockResolvedValue({ canAccessService: true });
  });

  it("명확한 invalid_credentials는 401로 반환하고 credential failure를 기록한다", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: {
        name: "AuthApiError",
        message: "Invalid login credentials",
        status: 400,
        code: "invalid_credentials",
      },
    });

    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_INVALID_CREDENTIALS);
    expect(body.success).toBe(false);
    expect(body.data).toBeNull();
    expect(loginRateLimit.recordResult).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      result: "credential_failure",
    });
  });

  it("invalid_credentials code라도 status가 다르면 credential failure로 추정하지 않는다", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: {
        name: "AuthApiError",
        message: "unexpected provider response",
        status: 500,
        code: "invalid_credentials",
      },
    });

    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_INTERNAL_ERROR);
    expect(loginRateLimit.recordResult).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      result: "non_credential_failure",
    });
  });

  it("unknown Provider error는 500으로 반환하고 streak를 변경하지 않는다", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: {
        name: "AuthApiError",
        message: "unknown provider error",
        status: 503,
        code: "unexpected_failure",
      },
    });

    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_INTERNAL_ERROR);
    expect(body.data).toBeNull();
    expect(loginRateLimit.recordResult).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      result: "non_credential_failure",
    });
  });

  it("signInWithPassword가 throw하면 attempt는 유지하고 streak는 변경하지 않는다", async () => {
    mockSignIn.mockRejectedValue(new Error("provider transport failed"));

    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_INTERNAL_ERROR);
    expect(body.data).toBeNull();
    expect(loginRateLimit.recordResult).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      result: "non_credential_failure",
    });
  });

  it("Provider 오류 응답에 raw Provider detail을 노출하지 않는다", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: {
        name: "AuthApiError",
        message: "sensitive provider detail",
        status: 500,
        code: "provider_internal_detail",
      },
    });

    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(JSON.stringify(body)).not.toContain("sensitive provider detail");
    expect(JSON.stringify(body)).not.toContain("provider_internal_detail");
  });
});
