/**
 * 회원가입 API - rate limit 정책 테스트
 *
 * 목적:
 * - IP + 이메일 기반 rate limit 동작 검증
 * - brute force / abuse / account enumeration 시도 방어
 *
 * 핵심 보안 포인트:
 * - 특정 계정 존재 여부와 무관하게 동일하게 rate limit 적용
 * - limit 초과 시 signup 로직 자체가 실행되지 않아야 함
 * - 실패 응답도 API 계약 구조를 유지해야 함
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { resetRateLimitStores } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";

/**
 * 외부 의존성 mock
 * - getUserByEmail: 사용자 존재 여부 제어
 * - createClient: Supabase auth.signUp 호출 추적
 */
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/lib/supabase/server");

/**
 * 테스트 간 rate limit 상태 공유 방지
 * - in-memory store 초기화
 */
beforeEach(() => {
  resetRateLimitStores();
});

describe("PR-API-06 회원가입 - IP/이메일 기반 rate limit", () => {
  const mockSignUp = vi.fn();

  /**
   * 공통 payload (email만 동적으로 변경)
   */
  const BASE_BODY = {
    password: "Password123!",
    nickname: "tester",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  /**
   * 요청 생성 helper
   *
   * 역할:
   * - IP와 이메일 조합을 자유롭게 테스트하기 위함
   * - x-forwarded-for를 통해 서버에서 IP 추출 로직 검증
   */
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
    /**
     * fake timer 설정
     * - rate limit window(시간 기반) 테스트를 위해 필요
     */
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    vi.clearAllMocks();

    /**
     * Supabase mock
     * - signup 호출 여부 및 횟수 추적
     */
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);

    /**
     * 기본값: 신규 사용자 (rate limit 테스트에서는 중요하지 않음)
     */
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    /**
     * signup 성공 응답 mock
     */
    mockSignUp.mockResolvedValue({
      data: { user: { email: "test@example.com" } },
      error: null,
    });
  });

  afterEach(() => {
    /**
     * timer 원복
     */
    vi.useRealTimers();
  });

  it("TC-01. 동일 IP로 10번까지 요청이 허용된다", async () => {
    const ip = "10.1.0.1";

    /**
     * 같은 IP에서 서로 다른 이메일로 요청
     * → IP limit만 검증
     */
    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest(ip, `tc01user${i}@example.com`));
      expect(response.status).not.toBe(429);
    }

    /**
     * limit 내에서는 signup 정상 호출
     */
    expect(mockSignUp).toHaveBeenCalledTimes(10);
  });

  it("TC-02. 동일 IP로 11번째 요청은 429를 반환한다", async () => {
    const ip = "10.2.0.1";

    for (let i = 0; i < 10; i++) {
      await POST(makeRequest(ip, `tc02user${i}@example.com`));
    }

    /**
     * limit 초과 요청
     */
    const response = await POST(makeRequest(ip, "tc02overflow@example.com"));
    const body = await response.json();

    /**
     * rate limit 응답 검증
     */
    expect(response.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(body.data).toBeNull();

    /**
     * 초과 요청에서는 signup이 호출되지 않아야 함
     */
    expect(mockSignUp).toHaveBeenCalledTimes(10);
  });

  it("TC-03. 동일 이메일로 5번까지 요청이 허용된다", async () => {
    const email = "tc03@example.com";

    /**
     * IP를 바꿔서 이메일 limit만 검증
     */
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

    /**
     * 초과 요청에서는 signup이 호출되지 않아야 함
     */
    expect(mockSignUp).toHaveBeenCalledTimes(5);
  });

  it("TC-05. 동일 IP로 10번째 요청이 경계값으로 허용된다", async () => {
    const ip = "10.5.0.1";

    for (let i = 0; i < 9; i++) {
      await POST(makeRequest(ip, `tc05user${i}@example.com`));
    }

    /**
     * 경계값 요청 (허용)
     */
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

    /**
     * 초과 이후 호출 초기화
     */
    mockSignUp.mockClear();

    /**
     * 같은 window에서는 계속 차단
     */
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

    /**
     * window 만료 (61초)
     */
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

    /**
     * 실패 응답도 API 계약 유지
     */
    expect(response.status).toBe(429);
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("code");
    expect(body).toHaveProperty("data");

    /**
     * 불필요한 필드 노출 금지
     */
    expect(body).not.toHaveProperty("error");
    expect(body).not.toHaveProperty("errors");

    expect(body.data).toBeNull();
  });
});
