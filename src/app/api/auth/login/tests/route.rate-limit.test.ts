/**
 * 로그인 API rate limit 전용 테스트
 *
 * 검증 범위:
 * - IP precheck 차단 → 429 + LOGIN_RATE_LIMIT_EXCEEDED
 * - checkRequestEligibility 차단 → 429 + LOGIN_RATE_LIMIT_EXCEEDED
 * - rate limit 차단 시 signInWithPassword 호출 차단
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import {
  checkIpRateLimitPrecheck,
  checkRequestEligibility,
  resetEligibilityStore,
} from "@/features/auth/lib/checkRequestEligibility";

import { POST } from "../route";
import {
  DEFAULT_LOGIN_BODY,
  makeLoginRequest,
  mockEligibilityAllowed,
  mockIpPrecheckAllowed,
  mockLoginSuccess,
  mockSignIn,
  resetLoginApiMocks,
  setupLoginApiMocks,
} from "./utils/loginTestHelper";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/utils/getClientIp", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

// checkRequestEligibility와 precheck는 부분 mock으로 차단 시나리오를 직접 제어
vi.mock("@/features/auth/lib/checkRequestEligibility", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/auth/lib/checkRequestEligibility")
  >("@/features/auth/lib/checkRequestEligibility");
  return {
    ...actual,
    checkIpRateLimitPrecheck: vi.fn(),
    checkRequestEligibility: vi.fn(),
  };
});

describe("로그인 API rate limit 처리", () => {
  beforeEach(() => {
    resetEligibilityStore();
    resetLoginApiMocks();
    setupLoginApiMocks();
    mockLoginSuccess();

    // 기본적으로 허용 상태로 초기화
    mockIpPrecheckAllowed();
    mockEligibilityAllowed();
  });

  it("TC-01: IP precheck 차단 시 429 + LOGIN_RATE_LIMIT_EXCEEDED를 반환한다", async () => {
    vi.mocked(checkIpRateLimitPrecheck).mockReturnValue({ allowed: false });

    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED);
    expect(body.success).toBe(false);
  });

  it("TC-02: IP precheck 차단 시 signInWithPassword가 호출되지 않는다", async () => {
    vi.mocked(checkIpRateLimitPrecheck).mockReturnValue({ allowed: false });

    await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("TC-03: email rate limit 차단 시 429 + LOGIN_RATE_LIMIT_EXCEEDED를 반환한다", async () => {
    vi.mocked(checkRequestEligibility).mockReturnValue({
      allowed: false,
      blockedBy: "emailShort",
    });

    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED);
  });

  it("TC-04: emailLong 차단 시 signInWithPassword가 호출되지 않는다", async () => {
    vi.mocked(checkRequestEligibility).mockReturnValue({
      allowed: false,
      blockedBy: "emailLong",
    });

    await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("TC-05: ipLong 차단 시 429 + LOGIN_RATE_LIMIT_EXCEEDED를 반환한다", async () => {
    // [이유: IP long window 추가로 blockedBy: "ipLong" 시나리오가 새로 발생]
    vi.mocked(checkRequestEligibility).mockReturnValue({
      allowed: false,
      blockedBy: "ipLong",
    });

    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED);
    expect(body.success).toBe(false);
  });

  it("TC-06: ipLong 차단 시 signInWithPassword가 호출되지 않는다", async () => {
    // [이유: IP long window 추가로 blockedBy: "ipLong" 시나리오가 새로 발생]
    vi.mocked(checkRequestEligibility).mockReturnValue({
      allowed: false,
      blockedBy: "ipLong",
    });

    await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));

    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
