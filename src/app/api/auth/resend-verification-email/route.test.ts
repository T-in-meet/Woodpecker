import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { resetResendRateLimitStore } from "@/features/auth/resend-verification-email/lib/checkResendRateLimit";
import { getLastVerificationResendAt } from "@/features/auth/resend-verification-email/lib/getLastVerificationResendAt";
import { resendVerificationEmail } from "@/features/auth/resend-verification-email/lib/resendVerificationEmail";
import { setLastVerificationResendAt } from "@/features/auth/resend-verification-email/lib/setLastVerificationResendAt";

import { POST } from "./route";
vi.mock(
  "@/features/auth/resend-verification-email/lib/getLastVerificationResendAt",
);
vi.mock(
  "@/features/auth/resend-verification-email/lib/resendVerificationEmail",
);
vi.mock(
  "@/features/auth/resend-verification-email/lib/setLastVerificationResendAt",
);

describe("PR-API-09 이메일 인증 재전송 API 성공 흐름", () => {
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
    vi.clearAllMocks();
    resetResendRateLimitStore();
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(null);
    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
    vi.mocked(setLastVerificationResendAt).mockResolvedValue(undefined);
  });

  // TC-01: 유효 요청 시 resend 호출 및 성공 응답 반환
  it("TC-01. 유효한 요청 시 resend를 1회 호출하고 성공 응답을 반환한다", async () => {
    const response = await POST(makeRequest({ email: " Test@Example.COM " }));
    const body = await response.json();

    // Response assertions
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);
    expect(body.data.email).toBe("test@example.com");
    expect(body.data.resent).toBe(true);

    // External call assertions
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(resendVerificationEmail).toHaveBeenCalledWith("test@example.com");

    // Security assertions
    expect(body).not.toHaveProperty("error");
    expect(body).not.toHaveProperty("errors");
  });
});

describe("PR-API-10 이메일 재전송 1분 쿨다운 검증", () => {
  const now = 1_700_000_000_000;

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
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(null);
    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
    vi.mocked(setLastVerificationResendAt).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // TC-01: 마지막 재전송 타임스탬프 없으면 첫 요청 허용
  it("TC-01. 마지막 재전송 타임스탬프가 없으면 첫 요청이 허용된다", async () => {
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(null);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);
    expect(typeof body.data).toBe("object");
    expect(getLastVerificationResendAt).toHaveBeenCalledTimes(1);
    expect(getLastVerificationResendAt).toHaveBeenCalledWith(
      "test@example.com",
    );
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(resendVerificationEmail).toHaveBeenCalledWith("test@example.com");
    expect(setLastVerificationResendAt).toHaveBeenCalledTimes(1);
    expect(setLastVerificationResendAt).toHaveBeenCalledWith(
      "test@example.com",
      now,
    );
  });

  // TC-02: 59초 전 타임스탬프 → 차단
  it("TC-02. 마지막 재전송 타임스탬프가 59초 전이면 요청이 차단된다", async () => {
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(now - 59 * 1000);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.code).toBe(
      AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_COOLDOWN_CONFLICT,
    );
    expect(body.data).toBeNull();
    expect(getLastVerificationResendAt).toHaveBeenCalledTimes(1);
    expect(resendVerificationEmail).toHaveBeenCalledTimes(0);
    expect(setLastVerificationResendAt).toHaveBeenCalledTimes(0);
  });

  // TC-03: 60초 전 타임스탬프 → 허용
  it("TC-03. 마지막 재전송 타임스탬프가 60초 전이면 요청이 허용된다", async () => {
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(now - 60 * 1000);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);
    expect(typeof body.data).toBe("object");
    expect(getLastVerificationResendAt).toHaveBeenCalledTimes(1);
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(resendVerificationEmail).toHaveBeenCalledWith("test@example.com");
    expect(setLastVerificationResendAt).toHaveBeenCalledTimes(1);
    expect(setLastVerificationResendAt).toHaveBeenCalledWith(
      "test@example.com",
      now,
    );
  });

  // TC-04: 차단 시 외부 resend 호출 없음
  it("TC-04. 차단된 요청은 외부 resend 호출을 발생시키지 않는다", async () => {
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(now - 59 * 1000);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.code).toBe(
      AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_COOLDOWN_CONFLICT,
    );
    expect(resendVerificationEmail).toHaveBeenCalledTimes(0);
  });

  // TC-05: 차단 시 타임스탬프 업데이트 없음
  it("TC-05. 차단된 요청은 마지막 재전송 타임스탬프를 업데이트하지 않는다", async () => {
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(now - 59 * 1000);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.code).toBe(
      AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_COOLDOWN_CONFLICT,
    );
    expect(setLastVerificationResendAt).toHaveBeenCalledTimes(0);
  });

  // TC-06: 허용 시 현재 시각으로 타임스탬프 저장
  it("TC-06. 허용된 요청은 마지막 재전송 타임스탬프를 현재 시각으로 저장한다", async () => {
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(null);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(setLastVerificationResendAt).toHaveBeenCalledTimes(1);
    expect(setLastVerificationResendAt).toHaveBeenCalledWith(
      "test@example.com",
      now,
    );
  });
});

describe("PR-API-11 이메일 재전송 Rate Limit 검증 (5회/1분)", () => {
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.mocked(getLastVerificationResendAt).mockResolvedValue(null);
    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
    vi.mocked(setLastVerificationResendAt).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // TC-01: 동일 이메일 5회 이내 모두 허용
  it("TC-01. 동일 이메일로 5회 이내 요청은 모두 허용된다", async () => {
    for (let i = 0; i < 5; i++) {
      const response = await POST(makeRequest());
      const body = await response.json();

      expect(response.status).not.toBe(429);
      expect(body.success).toBe(true);
      expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);
    }

    expect(resendVerificationEmail).toHaveBeenCalledTimes(5);
  });

  // TC-02: 6번째 요청은 차단
  it("TC-02. 동일 이메일로 6번째 요청은 차단된다", async () => {
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest());
    }
    vi.clearAllMocks();

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED);
    expect(body.data).toBeNull();
    expect(resendVerificationEmail).toHaveBeenCalledTimes(0);
  });

  // TC-03: 4회 후 5번째는 허용 (경계값)
  it("TC-03. 동일 이메일로 4회 요청 후 5번째 요청은 허용된다", async () => {
    for (let i = 0; i < 4; i++) {
      await POST(makeRequest());
    }
    vi.clearAllMocks();

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).not.toBe(429);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  // TC-04: 한도 초과 후 동일 윈도우 내 추가 요청 계속 차단
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
      expect(body.code).toBe(AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED);
    }

    expect(resendVerificationEmail).toHaveBeenCalledTimes(0);
  });

  // TC-05: 1분 경과 후 허용 (윈도우 리셋)
  it("TC-05. 1분 이상 경과 후 동일 이메일 요청이 다시 허용된다", async () => {
    for (let i = 0; i < 6; i++) {
      await POST(makeRequest());
    }
    vi.clearAllMocks();

    vi.advanceTimersByTime(61 * 1000);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).not.toBe(429);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
  });
});
