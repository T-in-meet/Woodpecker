/**
 * 이메일 재전송 API 최소 응답 시간 보장 테스트
 *
 * 목적:
 * - resend 분기별 처리 차이가 외부 응답 시간으로 노출되지 않도록 검증
 * - 모든 경로가 최소 응답 시간(MIN_RESPONSE_MS) 이후에만 응답하는지 확인
 * - 이메일 존재 여부와 무관하게 동일한 응답 시간 보장 (Account Enumeration 방어)
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { MIN_RESPONSE_MS } from "@/features/auth/lib/applyMinimumResponseTime";
import { resetEligibilityStore } from "@/features/auth/lib/checkRequestEligibility";
import { resendVerificationEmail } from "@/features/auth/resend-verification-email/lib/resendVerificationEmail";

import { POST } from "./route";

vi.mock(
  "@/features/auth/resend-verification-email/lib/resendVerificationEmail",
);

const START_TIME = 1_000_000;

function makeRequest(body: object, ip?: string): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (ip) {
    headers["x-forwarded-for"] = ip;
  }
  return new NextRequest(
    "http://localhost/api/auth/resend-verification-email",
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
  );
}

async function expectPendingUntilMinimumTime<T>(promise: Promise<T>) {
  let resolved = false;

  promise.then(() => {
    resolved = true;
  });

  await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS - 1);
  expect(resolved).toBe(false);

  await vi.advanceTimersByTimeAsync(1);
  await Promise.resolve();
  expect(resolved).toBe(true);
}

function useFakeClockWithNoElapsedTime() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(START_TIME));
}

async function postAfterMinimumTime(request: NextRequest) {
  const promise = POST(request);
  await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS);
  return promise;
}

function mockSlowExecution() {
  vi.spyOn(Date, "now")
    .mockReturnValueOnce(START_TIME)
    .mockReturnValue(START_TIME + MIN_RESPONSE_MS + 500);
}

describe("resend 최소 응답 시간 보장", () => {
  beforeEach(() => {
    resetEligibilityStore();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();

    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
  });

  it("TC-01: IP rate limit precheck 빠른 경로도 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFakeClockWithNoElapsedTime();
    const ip = "127.0.0.1";

    // IP limit (10 req/1min)을 먼저 초과
    for (let i = 0; i < 10; i++) {
      await postAfterMinimumTime(
        makeRequest({ email: `user${i}@example.com` }, ip),
      );
    }

    // 다음 요청은 rate limit 초과
    vi.useFakeTimers();
    vi.setSystemTime(new Date(START_TIME));
    const promise = POST(makeRequest({ email: "overflow@example.com" }, ip));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED);
  });

  it("TC-02: malformed JSON 빠른 경로도 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFakeClockWithNoElapsedTime();

    const request = new NextRequest(
      "http://localhost/api/auth/resend-verification-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      },
    );

    const promise = POST(request);

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(AUTH_API_CODES.RESEND_INVALID_INPUT);
  });

  it("TC-03: Zod validation 실패 빠른 경로도 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFakeClockWithNoElapsedTime();

    const promise = POST(makeRequest({ email: "invalid-email" }));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(AUTH_API_CODES.RESEND_INVALID_INPUT);
  });

  it("TC-04: email rate limit 빠른 경로도 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFakeClockWithNoElapsedTime();
    const email = "test@example.com";
    const ip = "127.0.0.1";

    // email short window (1 req/30s) 초과 요청
    await postAfterMinimumTime(makeRequest({ email }, ip));

    // 다음 재시도는 short window 위반
    vi.useFakeTimers();
    vi.setSystemTime(new Date(START_TIME));
    const promise = POST(makeRequest({ email }, ip));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED);
  });

  it("TC-05: 성공 경로도 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFakeClockWithNoElapsedTime();

    const promise = POST(makeRequest({ email: "test@example.com" }));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);
    expect(vi.mocked(resendVerificationEmail)).toHaveBeenCalledTimes(1);
  });

  it("TC-06: 경과 시간이 이미 최소 응답 시간을 넘으면 추가 지연 없이 반환한다", async () => {
    mockSlowExecution();
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");

    const response = await POST(makeRequest({ email: "test@example.com" }));

    expect(response.status).toBe(200);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it("TC-07: 이메일 발송 실패 내부 예외도 최소 응답 시간을 보장한다", async () => {
    useFakeClockWithNoElapsedTime();

    vi.mocked(resendVerificationEmail).mockRejectedValue(
      new Error("Email service error"),
    );

    const promise = POST(makeRequest({ email: "test@example.com" }));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    // 이메일 발송 실패는 내부 예외로 처리되지만, 외부 응답은 성공 유지 (응답 계약 통일)
    expect(response.status).toBe(200);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);
  });

  it("TC-08: 최소 응답 시간 적용 후에도 성공 응답 계약이 유지된다", async () => {
    useFakeClockWithNoElapsedTime();

    const promise = POST(makeRequest({ email: "test@example.com" }));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);
    expect(body.data).toEqual({
      email: "test@example.com",
      resent: true,
    });
  });

  it("TC-09: 최소 응답 시간 적용 후에도 실패 응답 계약이 유지된다", async () => {
    useFakeClockWithNoElapsedTime();

    const promise = POST(makeRequest({ email: "invalid-email" }));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.RESEND_INVALID_INPUT);
  });
});
