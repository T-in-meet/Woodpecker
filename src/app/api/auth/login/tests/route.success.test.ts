/**
 * 로그인 API 성공 흐름 전용 테스트.
 *
 * 검증 범위:
 * - 성공 응답/redirect 계약 유지
 * - Provider에는 사용자가 입력한 실제 email 전달
 * - 성공 시 Login failure streak clear
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
  mockSignOut,
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

describe("로그인 API 성공 흐름", () => {
  beforeEach(() => {
    resetLoginApiMocks();
    setupLoginApiMocks();
    setupLoginSecurityMocks();
    mockLoginSuccess();
    getLegalAcceptanceStatusMock.mockResolvedValue({ canAccessService: true });
  });

  it("TC-01: 올바른 자격 증명이면 200을 반환한다", async () => {
    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));

    expect(response.status).toBe(200);
  });

  it("TC-02: 성공 응답 body는 success true, code LOGIN_SUCCESS를 포함한다", async () => {
    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_SUCCESS);
  });

  it("TC-03: redirect query가 없으면 data.redirectTo는 /mypage이다", async () => {
    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(body.data.redirectTo).toBe("/mypage");
  });

  it("TC-04: 유효한 redirect query가 있으면 data.redirectTo에 반영된다", async () => {
    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY, "/notes"));
    const body = await response.json();

    expect(body.data.redirectTo).toBe("/notes");
  });

  it("TC-05: 차단된 redirect query(/login)는 /mypage로 fallback된다", async () => {
    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY, "/login"));
    const body = await response.json();

    expect(body.data.redirectTo).toBe("/mypage");
  });

  it("TC-06: dynamic note redirect를 data.redirectTo에 반영한다", async () => {
    const redirectTo = "/notes/550e8400-e29b-41d4-a716-446655440000";

    const response = await POST(
      makeLoginRequest(DEFAULT_LOGIN_BODY, redirectTo),
    );
    const body = await response.json();

    expect(body.data.redirectTo).toBe(redirectTo);
  });

  it("TC-07: signInWithPassword는 사용자가 입력한 실제 email로 호출된다", async () => {
    await POST(
      makeLoginRequest({
        email: "User@Example.COM",
        password: "Password123!",
      }),
    );

    expect(mockSignIn).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "User@Example.COM",
      }),
    );
  });

  it("TC-08: 성공 응답 data는 redirectTo만 포함한다", async () => {
    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(Object.keys(body.data)).toEqual(["redirectTo"]);
  });

  it("TC-09: 최신 확인 기록이 없으면 세션을 유지하고 재확인 화면으로 redirect한다", async () => {
    getLegalAcceptanceStatusMock.mockResolvedValue({
      canAccessService: false,
    });

    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(body.data.redirectTo).toBe("/agreements?redirect=%2Fmypage");
  });

  it("TC-10: Provider 성공은 failure streak를 clear하도록 기록한다", async () => {
    await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));

    expect(loginRateLimit.recordResult).toHaveBeenCalledWith({
      canonicalEmail: "user@example.com",
      result: "success",
    });
  });
});
