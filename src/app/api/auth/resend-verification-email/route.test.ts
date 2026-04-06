import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// API 응답 코드 상수
import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
// Rate Limit store 초기화 (테스트 간 상태 격리)
import { resetResendRateLimitStore } from "@/features/auth/resend-verification-email/lib/checkResendRateLimit";
// 외부 의존성 (모두 mock 대상)
import { getLastVerificationResendAt } from "@/features/auth/resend-verification-email/lib/getLastVerificationResendAt";
import { resendVerificationEmail } from "@/features/auth/resend-verification-email/lib/resendVerificationEmail";
import { setLastVerificationResendAt } from "@/features/auth/resend-verification-email/lib/setLastVerificationResendAt";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

// 테스트 대상 API 핸들러
import { POST } from "./route";

/**
 * 외부 의존성 mock
 * - DB 조회, 외부 이메일 전송, 상태 저장 모두 실제 호출 방지
 */
vi.mock(
  "@/features/auth/resend-verification-email/lib/getLastVerificationResendAt",
);
vi.mock(
  "@/features/auth/resend-verification-email/lib/resendVerificationEmail",
);
vi.mock(
  "@/features/auth/resend-verification-email/lib/setLastVerificationResendAt",
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

    // Rate Limit 상태 초기화 (테스트 간 영향 제거)
    resetResendRateLimitStore();

    // 기본 mock 동작 정의
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(null);
    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
    vi.mocked(setLastVerificationResendAt).mockResolvedValue(undefined);
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
    resetResendRateLimitStore();
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
    expect(setLastVerificationResendAt).not.toHaveBeenCalled();
  });
});

describe("PR-API-10 이메일 재전송 1분 쿨다운 검증", () => {
  const now = 1_700_000_000_000; // 고정된 현재 시간 (테스트 안정성)

  function makeRequest(): NextRequest {
    return new NextRequest(
      "http://localhost/api/auth/resend-verification-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetResendRateLimitStore();

    /**
     * fake timer 사용 이유:
     * - 시간 기반 로직(쿨다운)을 deterministic하게 테스트하기 위함
     */
    vi.useFakeTimers();
    vi.setSystemTime(now);

    vi.mocked(getLastVerificationResendAt).mockResolvedValue(null);
    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
    vi.mocked(setLastVerificationResendAt).mockResolvedValue(undefined);
  });

  afterEach(() => {
    // 다른 테스트에 영향 주지 않도록 원복
    vi.useRealTimers();
  });

  // TC-01: 최초 요청 허용
  it("TC-01. 마지막 재전송 타임스탬프가 없으면 첫 요청이 허용된다", async () => {
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(null);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);

    // 흐름 검증: 조회 → 전송 → 저장
    expect(getLastVerificationResendAt).toHaveBeenCalledTimes(1);
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(setLastVerificationResendAt).toHaveBeenCalledWith(
      "test@example.com",
      now,
    );
  });

  // TC-02: 59초 → 차단
  it("TC-02. 마지막 재전송 타임스탬프가 59초 전이면 요청이 차단된다", async () => {
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(now - 59 * 1000);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.code).toBe(
      AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_COOLDOWN_CONFLICT,
    );

    // 차단 시 외부 호출 없음
    expect(resendVerificationEmail).toHaveBeenCalledTimes(0);
    expect(setLastVerificationResendAt).toHaveBeenCalledTimes(0);
  });

  // TC-03: 60초 → 허용 (경계값)
  it("TC-03. 마지막 재전송 타임스탬프가 60초 전이면 요청이 허용된다", async () => {
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(now - 60 * 1000);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(setLastVerificationResendAt).toHaveBeenCalledWith(
      "test@example.com",
      now,
    );
  });

  // TC-04: 차단 시 resend 호출 없음
  it("TC-04. 차단된 요청은 외부 resend 호출을 발생시키지 않는다", async () => {
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(now - 59 * 1000);

    const response = await POST(makeRequest());
    await response.json();

    expect(resendVerificationEmail).toHaveBeenCalledTimes(0);
  });

  // TC-05: 차단 시 timestamp 업데이트 없음
  it("TC-05. 차단된 요청은 마지막 재전송 타임스탬프를 업데이트하지 않는다", async () => {
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(now - 59 * 1000);

    const response = await POST(makeRequest());
    await response.json();

    expect(setLastVerificationResendAt).toHaveBeenCalledTimes(0);
  });

  // TC-06: 허용 시 timestamp 저장
  it("TC-06. 허용된 요청은 마지막 재전송 타임스탬프를 현재 시각으로 저장한다", async () => {
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(null);

    const response = await POST(makeRequest());
    await response.json();

    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(setLastVerificationResendAt).toHaveBeenCalledWith(
      "test@example.com",
      now,
    );
  });
});

describe("이메일 재전송 Rate Limit 검증 (5회/1분)", () => {
  function makeRequest(): NextRequest {
    return new NextRequest(
      "http://localhost/api/auth/resend-verification-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetResendRateLimitStore();

    // Rate limit은 시간 기반 → fake timer 필수
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    vi.mocked(getLastVerificationResendAt).mockResolvedValue(null);
    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
    vi.mocked(setLastVerificationResendAt).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // TC-01: 5회까지 허용
  it("TC-01. 동일 이메일로 5회 이내 요청은 모두 허용된다", async () => {
    for (let i = 0; i < 5; i++) {
      const response = await POST(makeRequest());
      const body = await response.json();

      expect(body.success).toBe(true);
    }

    expect(resendVerificationEmail).toHaveBeenCalledTimes(5);
  });

  // TC-02: 6번째 차단
  it("TC-02. 동일 이메일로 6번째 요청은 차단된다", async () => {
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest());
    }
    vi.clearAllMocks();

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.success).toBe(false);

    // 차단 시 외부 호출 없음
    expect(resendVerificationEmail).toHaveBeenCalledTimes(0);
  });

  // TC-03: 5번째는 허용 (경계값)
  it("TC-03. 동일 이메일로 4회 요청 후 5번째 요청은 허용된다", async () => {
    for (let i = 0; i < 4; i++) {
      await POST(makeRequest());
    }
    vi.clearAllMocks();

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  // TC-04: 한도 초과 후 계속 차단
  it("TC-04. 한도 초과 후 동일 윈도우 내 추가 요청은 계속 차단된다", async () => {
    for (let i = 0; i < 6; i++) {
      await POST(makeRequest());
    }
    vi.clearAllMocks();

    for (let i = 0; i < 3; i++) {
      const response = await POST(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.success).toBe(false);
    }
  });

  // TC-05: 1분 후 리셋
  it("TC-05. 1분 이상 경과 후 동일 이메일 요청이 다시 허용된다", async () => {
    for (let i = 0; i < 6; i++) {
      await POST(makeRequest());
    }
    vi.clearAllMocks();

    // 시간 경과 시뮬레이션
    vi.advanceTimersByTime(61 * 1000);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
  });
});
