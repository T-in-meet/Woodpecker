/**
 * 회원가입 API - rate limit 정책 테스트
 *
 * 목적:
 * - 단계형 rate limit 동작 검증
 * - brute force / abuse / account enumeration 시도 방어
 *
 * 핵심 보안 포인트:
 * - IP rate limit은 본문 파싱/validation 이전에 조기 적용
 * - email rate limit은 validation 이후 정규화된 이메일 기준으로 적용
 * - limit 초과 시 signup 로직 자체가 실행되지 않아야 함
 * - 실패 응답도 API 계약 구조를 유지해야 함
 *
 * 수정 이유:
 * - signup route는 모든 응답 경로에 최소 응답 시간 보장 정책을 적용한다.
 * - 이 테스트는 fake timer를 사용해 rate limit window를 검증하므로,
 *   각 요청 후 최소 응답 시간만큼 타이머를 함께 전진시켜야 POST가 완료된다.
 * - 즉시 응답을 가정하면 현재 구현 계약과 충돌하므로, 테스트가 최신 계약을 반영해야 한다.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { MIN_RESPONSE_MS } from "@/features/auth/lib/applyMinimumResponseTime";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { resetRateLimitStores } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { createAdminClient } from "@/lib/supabase/admin";

import { POST } from "../route";

/**
 * 외부 의존성 mock
 * - getUserByEmail: 사용자 존재 여부 제어
 * - createClient: Supabase auth.signUp 호출 추적
 */
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/sendAuthEmail");
vi.mock("@/lib/supabase/admin");

/**
 * 테스트 간 rate limit 상태 공유 방지
 * - in-memory store 초기화
 */
beforeEach(() => {
  resetRateLimitStores();
});

describe("PR-API-06 회원가입 - IP/이메일 기반 rate limit", () => {
  const mockGenerateLink = vi.fn();

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

  function makeInvalidRequest(ip: string): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({
        password: "Password123!",
        nickname: "tester",
      }),
    });
  }

  /**
   * 최소 응답 시간 정책과 fake timer를 함께 처리하는 요청 헬퍼
   */
  async function sendRequest(ip: string, email = "test@example.com") {
    const responsePromise = POST(makeRequest(ip, email));
    await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS);
    return responsePromise;
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
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { generateLink: mockGenerateLink } },
    } as never);

    /**
     * 기본값: 신규 사용자 (rate limit 테스트에서는 중요하지 않음)
     */
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    /**
     * signup 성공 응답 mock
     */
    mockGenerateLink.mockResolvedValue({
      data: {
        user: { id: "user-id", email: "test@example.com" },
        properties: { hashed_token: "hashed-token" },
      },
      error: null,
    });
    vi.mocked(sendAuthEmail).mockResolvedValue(undefined);
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
      const response = await sendRequest(ip, `tc01user${i}@example.com`);
      expect(response.status).not.toBe(429);
    }

    /**
     * limit 내에서는 signup 정상 호출
     */
    expect(mockGenerateLink).toHaveBeenCalledTimes(10);
  });

  it("TC-02. 동일 IP로 11번째 요청은 429를 반환한다", async () => {
    const ip = "10.2.0.1";

    for (let i = 0; i < 10; i++) {
      await sendRequest(ip, `tc02user${i}@example.com`);
    }

    /**
     * limit 초과 요청
     */
    const response = await sendRequest(ip, "tc02overflow@example.com");
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
    expect(mockGenerateLink).toHaveBeenCalledTimes(10);
  });

  it("TC-03. 동일 이메일로 5번까지 요청이 허용된다", async () => {
    const email = "tc03@example.com";

    /**
     * IP를 바꿔서 이메일 limit만 검증
     */
    for (let i = 0; i < 5; i++) {
      const response = await sendRequest(`10.3.${i}.1`, email);
      expect(response.status).not.toBe(429);
    }

    expect(mockGenerateLink).toHaveBeenCalledTimes(5);
  });

  it("TC-04. 동일 이메일로 6번째 요청은 429를 반환한다", async () => {
    const email = "tc04@example.com";

    for (let i = 0; i < 5; i++) {
      await sendRequest(`10.4.${i}.1`, email);
    }

    const response = await sendRequest("10.4.5.1", email);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(body.data).toBeNull();

    /**
     * 초과 요청에서는 signup이 호출되지 않아야 함
     */
    expect(mockGenerateLink).toHaveBeenCalledTimes(5);
  });

  it("TC-05. 동일 IP로 10번째 요청이 경계값으로 허용된다", async () => {
    const ip = "10.5.0.1";

    for (let i = 0; i < 9; i++) {
      await sendRequest(ip, `tc05user${i}@example.com`);
    }

    /**
     * 경계값 요청 (허용)
     */
    const response = await sendRequest(ip, "tc05user9@example.com");

    expect(response.status).not.toBe(429);
    expect(mockGenerateLink).toHaveBeenCalledTimes(10);
  });

  it("TC-06. 동일 이메일로 5번째 요청이 경계값으로 허용된다", async () => {
    const email = "tc06@example.com";

    for (let i = 0; i < 4; i++) {
      await sendRequest(`10.6.${i}.1`, email);
    }

    const response = await sendRequest("10.6.4.1", email);

    expect(response.status).not.toBe(429);
    expect(mockGenerateLink).toHaveBeenCalledTimes(5);
  });

  it("TC-07. IP 한도 초과 후 같은 윈도우에서 계속 차단된다", async () => {
    const ip = "10.7.0.1";

    for (let i = 0; i < 11; i++) {
      await sendRequest(ip, `tc07user${i}@example.com`);
    }

    /**
     * 초과 이후 호출 초기화
     */
    mockGenerateLink.mockClear();

    /**
     * 같은 window에서는 계속 차단
     */
    for (let i = 0; i < 3; i++) {
      const response = await sendRequest(ip, `tc07extra${i}@example.com`);
      expect(response.status).toBe(429);
    }

    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  it("TC-08. 이메일 한도 초과 후 같은 윈도우에서 계속 차단된다", async () => {
    const email = "tc08@example.com";

    for (let i = 0; i < 6; i++) {
      await sendRequest(`10.8.${i}.1`, email);
    }

    mockGenerateLink.mockClear();

    for (let i = 0; i < 3; i++) {
      const response = await sendRequest(`10.8.${i + 10}.1`, email);
      expect(response.status).toBe(429);
    }

    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  it("TC-09. 윈도우 만료 후 IP limit이 리셋된다", async () => {
    const ip = "10.9.0.1";

    for (let i = 0; i < 11; i++) {
      await sendRequest(ip, `tc09user${i}@example.com`);
    }

    /**
     * window 만료 (61초)
     */
    vi.advanceTimersByTime(61 * 1000);

    const response = await sendRequest(ip, "tc09reset@example.com");

    expect(response.status).not.toBe(429);
    expect(mockGenerateLink).toHaveBeenCalled();
  });

  it("TC-10. 15분 윈도우 만료 후 이메일 limit이 리셋된다", async () => {
    const email = "tc10@example.com";

    for (let i = 0; i < 6; i++) {
      await sendRequest(`10.10.${i}.1`, email);
    }

    vi.advanceTimersByTime(14 * 60 * 1000);

    const stillBlocked = await sendRequest("10.10.20.1", email);
    expect(stillBlocked.status).toBe(429);

    vi.advanceTimersByTime(61 * 1000);

    const response = await sendRequest("10.10.10.1", email);

    expect(response.status).not.toBe(429);
    expect(mockGenerateLink).toHaveBeenCalled();
  });

  it("TC-11A. 이메일이 달라도 IP limit은 동작한다", async () => {
    const ip = "10.11.0.1";

    for (let i = 0; i < 10; i++) {
      await sendRequest(ip, `user${i}@example.com`);
    }

    const response = await sendRequest(ip, "overflow@example.com");
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  });

  it("TC-11B. IP가 달라도 이메일 limit은 동작한다", async () => {
    const email = "tc11b@example.com";

    for (let i = 0; i < 5; i++) {
      await sendRequest(`10.11.${i}.2`, email);
    }

    const response = await sendRequest("10.11.10.2", email);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  });

  it("TC-12. rate limit 실패 응답이 API 계약 구조를 유지한다", async () => {
    const ip = "10.12.0.1";

    for (let i = 0; i < 11; i++) {
      await sendRequest(ip);
    }

    const response = await sendRequest(ip);
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

  it("TC-13. validation 실패 요청도 동일 IP 기준으로 누적되어 차단된다", async () => {
    const ip = "10.13.0.1";

    for (let i = 0; i < 10; i++) {
      const responsePromise = POST(makeInvalidRequest(ip));
      await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS);
      const response = await responsePromise;
      expect(response.status).toBe(400);
    }

    const blocked = await sendRequest(ip, "tc13@example.com");
    const body = await blocked.json();

    expect(blocked.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  it("TC-14. validation 실패 요청은 이메일 limit을 소모하지 않는다", async () => {
    const email = "tc14@example.com";

    for (let i = 0; i < 5; i++) {
      const responsePromise = POST(
        new NextRequest("http://localhost/api/auth/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": `10.14.${i}.1`,
          },
          body: JSON.stringify({
            email,
            nickname: "tester",
          }),
        }),
      );
      await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS);
      const response = await responsePromise;
      expect(response.status).toBe(400);
    }

    for (let i = 0; i < 5; i++) {
      const response = await sendRequest(`10.14.${i + 10}.1`, email);
      expect(response.status).not.toBe(429);
    }

    const blocked = await sendRequest("10.14.99.1", email);
    expect(blocked.status).toBe(429);
  });

  it("TC-15. IP rate limit hit 시 구조화된 경고 로그를 남긴다", async () => {
    const ip = "10.15.0.1";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    for (let i = 0; i < 10; i++) {
      await sendRequest(ip, `tc15user${i}@example.com`);
    }

    const response = await sendRequest(ip, "tc15blocked@example.com");

    expect(response.status).toBe(429);
    expect(warnSpy).toHaveBeenCalledWith(
      "signup_rate_limit_hit",
      expect.objectContaining({
        dimension: "ip",
        route: "/api/auth/signup",
        limit: 10,
        windowMs: 60 * 1000,
        ipMasked: "10.15.*.*",
      }),
    );
  });

  it("TC-16. email rate limit hit 시 구조화된 경고 로그를 남긴다", async () => {
    const email = "tc16@example.com";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    for (let i = 0; i < 5; i++) {
      await sendRequest(`10.16.${i}.1`, email);
    }

    const response = await sendRequest("10.16.99.1", email);

    expect(response.status).toBe(429);
    expect(warnSpy).toHaveBeenCalledWith(
      "signup_rate_limit_hit",
      expect.objectContaining({
        dimension: "email",
        route: "/api/auth/signup",
        limit: 5,
        windowMs: 15 * 60 * 1000,
        emailMasked: "t***@example.com",
      }),
    );
  });
});
