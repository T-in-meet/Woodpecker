import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLastVerificationResendAt } from "@/lib/auth/getLastVerificationResendAt";
import { resendVerificationEmail } from "@/lib/auth/resendVerificationEmail";
import { setLastVerificationResendAt } from "@/lib/auth/setLastVerificationResendAt";
import { AUTH_API_CODES } from "@/lib/constants/authApiCodes";

import { POST } from "./route";
vi.mock("@/lib/auth/getLastVerificationResendAt");
vi.mock("@/lib/auth/resendVerificationEmail");
vi.mock("@/lib/auth/setLastVerificationResendAt");

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
    vi.useFakeTimers();
    vi.setSystemTime(now);
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
