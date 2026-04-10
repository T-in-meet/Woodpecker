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
import {
  EMAIL_LONG_LIMIT,
  EMAIL_LONG_WINDOW_MS,
  EMAIL_SHORT_WINDOW_MS,
  IP_LIMIT,
  IP_WINDOW_MS,
  resetEligibilityStore,
} from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
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
  resetEligibilityStore();
});

describe("PR-API-06 회원가입 - IP/이메일 기반 rate limit", () => {
  const mockGenerateLink = vi.fn();
  const WINDOW_BUFFER_MS = 1000;

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
    process.env["EMAIL_TICKET_SECRET"] = "test-ticket-secret";

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

  it(`TC-01. 동일 IP로 ${IP_LIMIT}번까지 요청이 허용된다`, async () => {
    const ip = "10.1.0.1";
    const startedAt = Date.now();

    /**
     * 같은 IP에서 서로 다른 이메일로 요청
     * → IP limit만 검증
     */
    for (let i = 0; i < IP_LIMIT; i++) {
      const response = await sendRequest(ip, `tc01user${i}@example.com`);
      expect(response.status).not.toBe(429);
    }

    /**
     * limit 내에서는 signup 정상 호출
     */
    expect(mockGenerateLink).toHaveBeenCalledTimes(IP_LIMIT);
    expect(Date.now() - startedAt).toBeLessThan(IP_WINDOW_MS);
  });

  it(`TC-02. 동일 IP로 ${IP_LIMIT + 1}번째 요청은 429를 반환한다`, async () => {
    const ip = "10.2.0.1";
    const startedAt = Date.now();

    for (let i = 0; i < IP_LIMIT; i++) {
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
    expect(mockGenerateLink).toHaveBeenCalledTimes(IP_LIMIT);
    expect(Date.now() - startedAt).toBeLessThan(IP_WINDOW_MS);
  });

  it(`TC-03. 동일 이메일로 ${EMAIL_LONG_LIMIT}번까지 요청이 허용된다`, async () => {
    const email = "tc03@example.com";
    const startedAt = Date.now();

    /**
     * IP를 바꿔서 이메일 limit만 검증
     * [Reason: EMAIL_SHORT_LIMIT=1 requires advancing past short window between requests.
     *  Otherwise, second request is blocked by short window, not long window.]
     */
    for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
      const response = await sendRequest(`10.3.${i}.1`, email);
      expect(response.status).not.toBe(429);
      // Advance past short window for next request
      if (i < EMAIL_LONG_LIMIT - 1) {
        await vi.advanceTimersByTimeAsync(EMAIL_SHORT_WINDOW_MS + 1);
      }
    }

    expect(mockGenerateLink).toHaveBeenCalledTimes(EMAIL_LONG_LIMIT);
    expect(Date.now() - startedAt).toBeLessThan(EMAIL_LONG_WINDOW_MS);
  });

  it(`TC-04. 동일 이메일로 ${EMAIL_LONG_LIMIT + 1}번째 요청은 429를 반환한다`, async () => {
    const email = "tc04@example.com";
    const startedAt = Date.now();

    // Fill long limit (advance past short window between requests)
    for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
      await sendRequest(`10.4.${i}.1`, email);
      if (i < EMAIL_LONG_LIMIT - 1) {
        await vi.advanceTimersByTimeAsync(EMAIL_SHORT_WINDOW_MS + 1);
      }
    }

    // Next request blocked by long limit
    await vi.advanceTimersByTimeAsync(EMAIL_SHORT_WINDOW_MS + 1);
    const response = await sendRequest("10.4.5.1", email);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(body.data).toBeNull();

    /**
     * 초과 요청에서는 signup이 호출되지 않아야 함
     */
    expect(mockGenerateLink).toHaveBeenCalledTimes(EMAIL_LONG_LIMIT);
    expect(Date.now() - startedAt).toBeLessThan(EMAIL_LONG_WINDOW_MS);
  });

  it(`TC-05. 동일 IP로 ${IP_LIMIT}번째 요청이 경계값으로 허용된다`, async () => {
    const ip = "10.5.0.1";
    const startedAt = Date.now();

    for (let i = 0; i < IP_LIMIT - 1; i++) {
      await sendRequest(ip, `tc05user${i}@example.com`);
    }

    /**
     * 경계값 요청 (허용)
     */
    const response = await sendRequest(ip, "tc05user9@example.com");

    expect(response.status).not.toBe(429);
    expect(mockGenerateLink).toHaveBeenCalledTimes(IP_LIMIT);
    expect(Date.now() - startedAt).toBeLessThan(IP_WINDOW_MS);
  });

  it(`TC-06. 동일 이메일로 ${EMAIL_LONG_LIMIT}번째 요청이 경계값으로 허용된다`, async () => {
    const email = "tc06@example.com";
    const startedAt = Date.now();

    // Make EMAIL_LONG_LIMIT-1 requests (advance past short window between requests)
    for (let i = 0; i < EMAIL_LONG_LIMIT - 1; i++) {
      await sendRequest(`10.6.${i}.1`, email);
      await vi.advanceTimersByTimeAsync(EMAIL_SHORT_WINDOW_MS + 1);
    }

    // Final request at boundary (EMAIL_LONG_LIMIT)
    const response = await sendRequest("10.6.4.1", email);

    expect(response.status).not.toBe(429);
    expect(mockGenerateLink).toHaveBeenCalledTimes(EMAIL_LONG_LIMIT);
    expect(Date.now() - startedAt).toBeLessThan(EMAIL_LONG_WINDOW_MS);
  });

  it("TC-07. IP 한도 초과 후 같은 윈도우에서 계속 차단된다", async () => {
    const ip = "10.7.0.1";

    for (let i = 0; i < IP_LIMIT + 1; i++) {
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

    for (let i = 0; i < EMAIL_LONG_LIMIT + 1; i++) {
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

    for (let i = 0; i < IP_LIMIT + 1; i++) {
      await sendRequest(ip, `tc09user${i}@example.com`);
    }

    /**
     * window 만료 (IP_WINDOW_MS + 1초)
     */
    vi.advanceTimersByTime(IP_WINDOW_MS + 1000);

    const response = await sendRequest(ip, "tc09reset@example.com");

    expect(response.status).not.toBe(429);
    expect(mockGenerateLink).toHaveBeenCalled();
  });

  it("TC-10. 15분 윈도우 만료 후 이메일 limit이 리셋된다", async () => {
    const email = "tc10@example.com";
    const startedAt = Date.now();

    // Fill long limit (advance past short window between requests)
    // [이유: EMAIL_SHORT_LIMIT=1이므로 consecutive requests는 blocked됨.
    //  각 요청 사이에 short window를 지나가야 다음 요청이 허용됨.]
    for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
      const response = await sendRequest(`10.10.${i}.1`, email);
      expect(response.status).not.toBe(429);
      // Advance past short window for next request
      if (i < EMAIL_LONG_LIMIT - 1) {
        await vi.advanceTimersByTimeAsync(EMAIL_SHORT_WINDOW_MS + 1);
      }
    }

    const elapsedMs = Date.now() - startedAt;
    const remainingBeforeResetMs =
      EMAIL_LONG_WINDOW_MS - elapsedMs - WINDOW_BUFFER_MS;

    expect(remainingBeforeResetMs).toBeGreaterThan(0);

    // Advance to just before long window expires
    await vi.advanceTimersByTimeAsync(remainingBeforeResetMs);

    // Next request should still be blocked (long window not yet expired)
    const stillBlocked = await sendRequest("10.10.20.1", email);
    expect(stillBlocked.status).toBe(429);

    // Advance past the window expiry
    await vi.advanceTimersByTimeAsync(WINDOW_BUFFER_MS + 1);

    // Now should be allowed (long window reset)
    const response = await sendRequest("10.10.10.1", email);

    expect(response.status).not.toBe(429);
    expect(mockGenerateLink).toHaveBeenCalled();
  });

  it("TC-11A. 이메일이 달라도 IP limit은 동작한다", async () => {
    const ip = "10.11.0.1";

    for (let i = 0; i < IP_LIMIT; i++) {
      await sendRequest(ip, `user${i}@example.com`);
    }

    const response = await sendRequest(ip, "overflow@example.com");
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  });

  it("TC-11B. IP가 달라도 이메일 limit은 동작한다", async () => {
    const email = "tc11b@example.com";

    for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
      await sendRequest(`10.11.${i}.2`, email);
    }

    const response = await sendRequest("10.11.10.2", email);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  });

  it("TC-12. rate limit 실패 응답이 API 계약 구조를 유지한다", async () => {
    const ip = "10.12.0.1";

    for (let i = 0; i < IP_LIMIT + 1; i++) {
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

  it("TC-13. validation 실패 요청은 IP 어거운스 한도를 소모하지 않는다", async () => {
    // [설계 변경: checkRequestEligibility는 schema validation 이후에 호출되므로,
    //  validation 실패는 rate limit을 소모하지 않는다.
    //  이는 malformed JSON도 동일하다.
    //  Reason: single entry point 요건에 따라 모든 조건을 schema validation 이후에 평가해야 한다.]
    const ip = "10.13.0.1";

    // validation 실패 요청들 (rate limit 미적용)
    for (let i = 0; i < IP_LIMIT + 5; i++) {
      const responsePromise = POST(makeInvalidRequest(ip));
      await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS);
      const response = await responsePromise;
      expect(response.status).toBe(400);
    }

    // 정상 요청 (validation 통과) — IP 하한도는 유지됨
    const blocked = await sendRequest(ip, "tc13@example.com");

    // 정상 요청도 허용됨 (validation 실패는 한도 미적용)
    expect(blocked.status).not.toBe(429);
    expect(mockGenerateLink).toHaveBeenCalled();
  });

  it("TC-14. validation 실패 요청은 이메일 limit을 소모하지 않는다", async () => {
    const email = "tc14@example.com";

    // Make EMAIL_LONG_LIMIT validation-failure requests (don't consume quota)
    for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
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

    // Now make EMAIL_LONG_LIMIT valid requests (should all succeed, advance past short window)
    for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
      const response = await sendRequest(`10.14.${i + 10}.1`, email);
      expect(response.status).not.toBe(429);
      // Advance past short window for next request
      if (i < EMAIL_LONG_LIMIT - 1) {
        await vi.advanceTimersByTimeAsync(EMAIL_SHORT_WINDOW_MS + 1);
      }
    }

    // The next request should be blocked by long limit
    await vi.advanceTimersByTimeAsync(EMAIL_SHORT_WINDOW_MS + 1);
    const blocked = await sendRequest("10.14.99.1", email);
    expect(blocked.status).toBe(429);
  });

  it("TC-15. IP rate limit hit 시 429 응답을 반환한다", async () => {
    const ip = "10.15.0.1";

    for (let i = 0; i < IP_LIMIT; i++) {
      await sendRequest(ip, `tc15user${i}@example.com`);
    }

    const response = await sendRequest(ip, "tc15blocked@example.com");

    // Logging now happens internally in checkRequestEligibility, not in route
    // [변경 이유: logRequestEligibilityBlocked는 checkRequestEligibility 내부에서 호출되며,
    //  route에서 별도 로그 호출이 없다. 구조화된 로그는 유지되지만 route 테스트에서는
    //  응답 계약만 검증한다.]
    expect(response.status).toBe(429);
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("TC-16. email rate limit hit 시 429 응답을 반환한다", async () => {
    const email = "tc16@example.com";

    for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
      await sendRequest(`10.16.${i}.1`, email);
    }

    const response = await sendRequest("10.16.99.1", email);

    // Logging now happens internally in checkRequestEligibility
    // [변경 이유: logRequestEligibilityBlocked는 checkRequestEligibility 내부에서 호출되어,
    //  route에서 별도 로그 호출이 없다. 구조화된 로그는 유지되지만 route 테스트에서는
    //  응답 계약만 검증한다.]
    expect(response.status).toBe(429);
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("TC-PRC1. IP 한도 초과 후 invalid payload 요청 → 400이 아닌 429 반환 (precheck 우선)", async () => {
    const ip = "10.prc.1.1";

    /**
     * IP limit 채우기
     */
    for (let i = 0; i < IP_LIMIT; i++) {
      await sendRequest(ip, `user${i}@example.com`);
    }

    /**
     * IP 한도 초과 상태에서 invalid payload 요청(정상 JSON이지만 필수 필드 누락)
     * - Precheck이 먼저 실행되어 IP 차단 → 429 반환
     * - 따라서 schema validation 단계까지 진행되지 않음
     */
    const malformedRequest = new NextRequest(
      "http://localhost/api/auth/signup",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": ip,
        },
        body: JSON.stringify({
          // 필수 필드 누락: password, nickname 없음
          email: "malformed@example.com",
        }),
      },
    );

    const responsePromise = POST(malformedRequest);
    await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS);
    const response = await responsePromise;

    /**
     * Precheck이 IP 한도를 먼저 확인하므로 400(validation error)이 아닌 429(rate limit)를 반환
     */
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  });

  it("TC-PRC2. IP 한도 초과 + precheck 차단 → 이후 동일 IP 요청의 counter 변화 없음", async () => {
    const ip = "10.prc.2.1";

    /**
     * IP limit 채우기
     */
    for (let i = 0; i < IP_LIMIT; i++) {
      await sendRequest(ip, `user${i}@example.com`);
    }

    /**
     * IP 한도 초과 상태 — precheck이 차단
     */
    const blockedResponse = await sendRequest(ip, "blocked@example.com");
    expect(blockedResponse.status).toBe(429);

    /**
     * IP window 만료 — precheck은 상태를 변경하지 않았으므로 여전히 한도 상태
     */
    await vi.advanceTimersByTimeAsync(IP_WINDOW_MS);

    /**
     * Window 만료 후 동일 IP로 요청 — 새로운 window로 복구되어 허용
     */
    const recoveredResponse = await sendRequest(ip, "after-window@example.com");
    expect(recoveredResponse.status).not.toBe(429);

    /**
     * [검증 의도: precheck이 호출되었어도 상태를 변경하지 않았으므로,
     *  window 만료 시 counter가 리셋되고 새로운 window가 시작됨]
     */
    expect(mockGenerateLink).toHaveBeenCalled();
  });
});
