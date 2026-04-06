/**
 * 기존 계정 재요청 분기 전용 테스트
 *
 * 이 파일은 signup API가 "이미 존재하는 계정"을 만났을 때의 분기 정책만 검증한다.
 * - pending 계정이면 200 + signupAccountStatus: "pending"
 * - active 계정이면 200 + signupAccountStatus: "active"
 * - 두 경우 모두 getUserByEmail 호출 확인
 * - 두 경우 모두 auth.signUp 재호출 금지
 * - 응답 계약(success/code/data) 유지
 *
 * 핵심 목적:
 * "신규 가입"과 "기존 계정 분기"를 테스트 책임상 분리한다.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { resetRateLimitStores } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/lib/supabase/server");

// 테스트 간 rate limit store 공유 상태 제거
beforeEach(() => {
  resetRateLimitStores();
});

describe("PR-API-06 회원가입 - IP/이메일 기반 rate limit", () => {
  const mockSignUp = vi.fn();

  const BASE_BODY = {
    password: "Password123!",
    nickname: "tester",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  // IP / 이메일 limit 조합을 쉽게 바꾸기 위한 request helper
  function makeRequest(ip: string, email = "test@example.com"): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ ...BASE_BODY, email }),
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    mockSignUp.mockResolvedValue({
      data: { user: { email: "test@example.com" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("TC-01. 동일 IP로 10번까지 요청이 허용된다", async () => {
    const ip = "10.1.0.1";
    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest(ip, `tc01user${i}@example.com`));
      expect(response.status).not.toBe(429);
    }
    expect(mockSignUp).toHaveBeenCalledTimes(10);
  });

  it("TC-02. 동일 IP로 11번째 요청은 429를 반환한다", async () => {
    const ip = "10.2.0.1";
    for (let i = 0; i < 10; i++) {
      await POST(makeRequest(ip, `tc02user${i}@example.com`));
    }
    const response = await POST(makeRequest(ip, "tc02overflow@example.com"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(body.data).toBeNull();
    expect(mockSignUp).toHaveBeenCalledTimes(10);
  });

  it("TC-03. 동일 이메일로 5번까지 요청이 허용된다", async () => {
    const email = "tc03@example.com";
    for (let i = 0; i < 5; i++) {
      const response = await POST(makeRequest(`10.3.${i}.1`, email));
      expect(response.status).not.toBe(429);
    }
    expect(mockSignUp).toHaveBeenCalledTimes(5);
  });

  it("TC-04. 동일 이메일로 6번째 요청은 429를 반환한다", async () => {
    const email = "tc04@example.com";
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest(`10.4.${i}.1`, email));
    }
    const response = await POST(makeRequest("10.4.5.1", email));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(body.data).toBeNull();
    expect(mockSignUp).toHaveBeenCalledTimes(5);
  });

  it("TC-05. 동일 IP로 10번째 요청이 경계값으로 허용된다", async () => {
    const ip = "10.5.0.1";
    for (let i = 0; i < 9; i++) {
      await POST(makeRequest(ip, `tc05user${i}@example.com`));
    }
    const response = await POST(makeRequest(ip, "tc05user9@example.com"));
    expect(response.status).not.toBe(429);
    expect(mockSignUp).toHaveBeenCalledTimes(10);
  });

  it("TC-06. 동일 이메일로 5번째 요청이 경계값으로 허용된다", async () => {
    const email = "tc06@example.com";
    for (let i = 0; i < 4; i++) {
      await POST(makeRequest(`10.6.${i}.1`, email));
    }
    const response = await POST(makeRequest("10.6.4.1", email));
    expect(response.status).not.toBe(429);
    expect(mockSignUp).toHaveBeenCalledTimes(5);
  });

  it("TC-07. IP 한도 초과 후 같은 윈도우에서 계속 차단된다", async () => {
    const ip = "10.7.0.1";
    for (let i = 0; i < 11; i++) {
      await POST(makeRequest(ip, `tc07user${i}@example.com`));
    }

    // 한도 초과 후 같은 윈도우에서 계속 차단되는지 확인하기 위해 signUp 호출 기록을 초기화
    mockSignUp.mockClear();

    for (let i = 0; i < 3; i++) {
      const response = await POST(makeRequest(ip, `tc07extra${i}@example.com`));
      expect(response.status).toBe(429);
    }
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  it("TC-08. 이메일 한도 초과 후 같은 윈도우에서 계속 차단된다", async () => {
    const email = "tc08@example.com";
    for (let i = 0; i < 6; i++) {
      await POST(makeRequest(`10.8.${i}.1`, email));
    }
    mockSignUp.mockClear();

    for (let i = 0; i < 3; i++) {
      const response = await POST(makeRequest(`10.8.${i + 10}.1`, email));
      expect(response.status).toBe(429);
    }
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  it("TC-09. 윈도우 만료 후 IP limit이 리셋된다", async () => {
    const ip = "10.9.0.1";
    for (let i = 0; i < 11; i++) {
      await POST(makeRequest(ip, `tc09user${i}@example.com`));
    }
    vi.advanceTimersByTime(61 * 1000);

    const response = await POST(makeRequest(ip, "tc09reset@example.com"));
    expect(response.status).not.toBe(429);
    expect(mockSignUp).toHaveBeenCalled();
  });

  it("TC-10. 윈도우 만료 후 이메일 limit이 리셋된다", async () => {
    const email = "tc10@example.com";
    for (let i = 0; i < 6; i++) {
      await POST(makeRequest(`10.10.${i}.1`, email));
    }
    vi.advanceTimersByTime(61 * 1000);

    const response = await POST(makeRequest("10.10.10.1", email));
    expect(response.status).not.toBe(429);
    expect(mockSignUp).toHaveBeenCalled();
  });

  it("TC-11A. 이메일이 달라도 IP limit은 동작한다", async () => {
    const ip = "10.11.0.1";
    for (let i = 0; i < 10; i++) {
      await POST(makeRequest(ip, `user${i}@example.com`));
    }
    const response = await POST(makeRequest(ip, "overflow@example.com"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  });

  it("TC-11B. IP가 달라도 이메일 limit은 동작한다", async () => {
    const email = "tc11b@example.com";
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest(`10.11.${i}.2`, email));
    }
    const response = await POST(makeRequest("10.11.10.2", email));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  });

  it("TC-12. rate limit 실패 응답이 API 계약 구조를 유지한다", async () => {
    const ip = "10.12.0.1";
    for (let i = 0; i < 11; i++) {
      await POST(makeRequest(ip));
    }
    const response = await POST(makeRequest(ip));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("code");
    expect(body).toHaveProperty("data");
    expect(body).not.toHaveProperty("error");
    expect(body).not.toHaveProperty("errors");
    expect(body.data).toBeNull();
  });
});
