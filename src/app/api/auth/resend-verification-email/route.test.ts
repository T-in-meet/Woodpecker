import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// API 응답 코드 상수
import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
// Request Eligibility store 초기화 (테스트 간 상태 격리)
import {
  EMAIL_LONG_LIMIT,
  EMAIL_LONG_WINDOW_MS,
  resetEligibilityStore,
} from "@/features/auth/lib/checkRequestEligibility";
// 외부 의존성 (모두 mock 대상)
import { resendVerificationEmail } from "@/features/auth/resend-verification-email/lib/resendVerificationEmail";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

// 테스트 대상 API 핸들러
import { POST } from "./route";

/**
 * 외부 의존성 mock
 * - 외부 이메일 전송은 실제 호출 방지
 * [변경 이유: getLastVerificationResendAt / setLastVerificationResendAt는 cooldown 모델 제거로 불필요.
 *  요청 eligibility는 checkRequestEligibility 내부에서 처리됨]
 */
vi.mock(
  "@/features/auth/resend-verification-email/lib/resendVerificationEmail",
);

describe("이메일 인증 재전송 API 성공 흐름", () => {
  /**
   * NextRequest 생성 헬퍼
   * - 실제 HTTP 요청을 흉내냄
   */
  function makeRequest(body: object): NextRequest {
    return new NextRequest(
      "http://localhost/api/auth/resend-verification-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  beforeEach(() => {
    // 모든 mock 초기화
    vi.clearAllMocks();

    // Request Eligibility 상태 초기화 (테스트 간 영향 제거)
    resetEligibilityStore();

    // 기본 mock 동작 정의
    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
  });

  // TC-01: 정상 흐름
  it("TC-01. 유효한 요청 시 resend를 1회 호출하고 성공 응답을 반환한다", async () => {
    const response = await POST(makeRequest({ email: " Test@Example.COM " }));
    const body = await response.json();

    // 응답 검증 (HTTP + 계약)
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);

    // email normalize 확인 (trim + lowercase)
    expect(body.data.email).toBe("test@example.com");
    expect(body.data.resent).toBe(true);

    // 외부 의존 호출 검증
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(resendVerificationEmail).toHaveBeenCalledWith("test@example.com");

    // 보안: 불필요한 필드 노출 금지
    expect(body).not.toHaveProperty("error");
    expect(body).not.toHaveProperty("errors");
  });
});

describe("이메일 인증 재전송 API malformed JSON 처리", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEligibilityStore();
  });

  it("TC-01. malformed JSON 요청이면 INVALID_INPUT 응답을 반환한다", async () => {
    const request = new NextRequest(
      "http://localhost/api/auth/resend-verification-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"email":"test@example.com"',
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.RESEND_INVALID_INPUT);
    expect(body.data).toEqual({
      errors: [{ field: "body", reason: VALIDATION_REASON.INVALID_FORMAT }],
    });
    expect(resendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("이메일 재전송 Request Eligibility 검증", () => {
  /**
   * 설계 변경:
   * - 이전: cooldown timestamp 모델 (getLastVerificationResendAt / setLastVerificationResendAt)
   * - 현재: checkRequestEligibility 단일 entry point
   *        - email short window: 즉시 재시도 억제 (30초)
   *        - email long window: user-level rate limit (15분)
   *
   * 정책:
   * - email short window (30초): 연타 억제 (cooldown 대체)
   * - email long window (15분): user-level 요청 한도
   * - AND 평가: 두 조건 모두 통과해야 허용
   */

  function makeRequest(email: string): NextRequest {
    return new NextRequest(
      "http://localhost/api/auth/resend-verification-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetEligibilityStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Email short window (30초) — 즉시 재시도 억제
  describe("email short window (30초) — 즉시 재시도 억제", () => {
    it("TC-01. 첫 요청 후 30초 이내 재시도는 차단된다", async () => {
      const email = "test@example.com";

      // 첫 요청 허용
      const response1 = await POST(makeRequest(email));
      expect(response1.status).toBe(200);
      expect(resendVerificationEmail).toHaveBeenCalledTimes(1);

      // 10초 경과 후 재시도 차단 (short window 활성)
      vi.advanceTimersByTime(10 * 1000);
      const response2 = await POST(makeRequest(email));
      const body2 = await response2.json();

      expect(response2.status).toBe(429);
      expect(body2.code).toBe(AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED);
      expect(resendVerificationEmail).toHaveBeenCalledTimes(1); // 여전히 1회만
    });

    it("TC-02. short window 만료 후 (30초+) 재시도는 허용된다", async () => {
      const email = "test2@example.com";

      // 첫 요청
      await POST(makeRequest(email));
      expect(resendVerificationEmail).toHaveBeenCalledTimes(1);

      // 30초 초과 경과 → short window 만료 (하지만 long window는 활성)
      vi.advanceTimersByTime(31 * 1000);

      // 재시도 허용
      const response = await POST(makeRequest(email));
      expect(response.status).toBe(200);
      expect(resendVerificationEmail).toHaveBeenCalledTimes(2);
    });
  });

  // Email long window (15분) — user-level rate limit
  describe("email long window (15분) — user-level rate limit", () => {
    it(`TC-03. 동일 이메일로 ${EMAIL_LONG_LIMIT}회까지 허용된다`, async () => {
      const email = "longwindow@example.com";

      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        // 각 요청 사이에 short window 복구를 위해 30초+ 경과
        if (i > 0) {
          vi.advanceTimersByTime(31 * 1000);
        }

        const response = await POST(makeRequest(email));
        expect(response.status).toBe(200);
      }

      expect(resendVerificationEmail).toHaveBeenCalledTimes(EMAIL_LONG_LIMIT);
    });

    it(`TC-04. ${EMAIL_LONG_LIMIT + 1}번째 요청은 long window로 차단된다`, async () => {
      const email = "longblock@example.com";

      // EMAIL_LONG_LIMIT회 요청
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        if (i > 0) vi.advanceTimersByTime(31 * 1000);
        await POST(makeRequest(email));
      }

      // 다음 요청 차단 (long window 초과)
      vi.advanceTimersByTime(31 * 1000);
      const response = await POST(makeRequest(email));
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.code).toBe(AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED);
      expect(resendVerificationEmail).toHaveBeenCalledTimes(EMAIL_LONG_LIMIT);
    });

    it(`TC-05. long window 만료 후 (${EMAIL_LONG_WINDOW_MS}ms+) 다시 허용된다`, async () => {
      const email = "longrecover@example.com";

      // EMAIL_LONG_LIMIT회 요청 (long 한도 소진)
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        if (i > 0) vi.advanceTimersByTime(31 * 1000);
        await POST(makeRequest(email));
      }

      // long window 만료 전: 차단
      vi.advanceTimersByTime(31 * 1000);
      let response = await POST(makeRequest(email));
      expect(response.status).toBe(429);

      // long window 만료 (15분): 허용
      vi.advanceTimersByTime(EMAIL_LONG_WINDOW_MS);
      response = await POST(makeRequest(email));
      expect(response.status).toBe(200);
      expect(resendVerificationEmail).toHaveBeenCalledTimes(
        EMAIL_LONG_LIMIT + 1,
      );
    });
  });

  // 차단 시 resend 호출 없음
  describe("차단 시 동작", () => {
    it("TC-06. 차단된 요청은 resendVerificationEmail을 호출하지 않는다", async () => {
      const email = "noresend@example.com";

      // 첫 요청
      await POST(makeRequest(email));
      expect(resendVerificationEmail).toHaveBeenCalledTimes(1);

      // 즉시 재시도 (short window 차단)
      const response = await POST(makeRequest(email));
      expect(response.status).toBe(429);
      expect(resendVerificationEmail).toHaveBeenCalledTimes(1); // 증가하지 않음
    });
  });

  // 다양한 이메일 주소 독립 처리
  describe("이메일별 독립 처리", () => {
    it("TC-07. 다른 이메일은 요청 한도를 공유하지 않는다", async () => {
      const email1 = "user1@example.com";
      const email2 = "user2@example.com";

      // email1: long 한도 소진
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        if (i > 0) vi.advanceTimersByTime(31 * 1000);
        await POST(makeRequest(email1));
      }

      // email2: 여전히 허용됨
      const response = await POST(makeRequest(email2));
      expect(response.status).toBe(200);
      expect(resendVerificationEmail).toHaveBeenCalledTimes(
        EMAIL_LONG_LIMIT + 1,
      );
    });
  });
});
