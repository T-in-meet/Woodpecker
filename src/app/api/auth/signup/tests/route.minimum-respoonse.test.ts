/**
 * 회원가입 API 최소 응답 시간 보장 (Minimum Response Time Floor) 테스트
 *
 * 이 파일은 모든 응답 경로(성공/실패/예외)가 최소 응답 시간 이전에
 * 응답하지 않는다는 것을 검증한다.
 *
 * 목적:
 * - Account Enumeration 방어를 위한 응답 시간 정규화
 * - 실행 속도와 무관하게 일정 시간 이상 경과 후 응답 보장
 * - 경과 시간이 이미 최소 시간을 초과한 경우 추가 지연 없음 확인
 *
 * 제외:
 * - 약관 동의 검증 로직
 * - avatar 업로드 성공/실패
 * - DB 트리거 검증
 * - 상세 validation 에러 매핑
 * - 이메일 발송 성공/실패
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { MIN_RESPONSE_MS } from "@/features/auth/lib/applyMinimumResponseTime";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { resetRateLimitStores } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/lib/supabase/server");

/**
 * Date.now() mock의 기준 시각 (임의의 epoch ms)
 */
const START_TIME = 1_000_000;

describe("회원가입 API 최소 응답 시간 보장 검증", () => {
  const mockSignUp = vi.fn();

  beforeEach(() => {
    resetRateLimitStores();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();

    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);

    vi.mocked(getUserByEmail).mockResolvedValue(null);
  });

  const validBody = {
    email: "test@example.com",
    password: "Password123!",
    nickname: "테스터",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  function useFakeClockWithNoElapsedTime() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(START_TIME));
  }

  function makeMalformedJsonRequest(): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json }",
    });
  }

  function makeRequestWithIp(body: object, ip: string): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    });
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

  async function resolveAfterMinimumTime<T>(promise: Promise<T>) {
    await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS);
    return promise;
  }

  /**
   * 느린 실행 경로 시뮬레이션
   * 시작 시각: START_TIME, 이후 모든 호출: START_TIME + MIN + buffer
   * elapsed > MIN_RESPONSE_MS → 추가 지연 불필요
   */
  function mockSlowExecution() {
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(START_TIME)
      .mockReturnValue(START_TIME + MIN_RESPONSE_MS + 500);
  }

  function mockSignUpSuccess() {
    mockSignUp.mockResolvedValue({
      data: { user: { email: "test@example.com" } },
      error: null,
    });
  }

  it("TC-01: fast success path → 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFakeClockWithNoElapsedTime();
    mockSignUpSuccess();

    const promise = POST(makeRequest(validBody));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    expect(response.status).toBe(200);
  });

  it("TC-02: fast existing-user path → 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFakeClockWithNoElapsedTime();

    vi.mocked(getUserByEmail).mockResolvedValue({
      email: "test@example.com",
      email_confirmed_at: null,
    });

    const promise = POST(makeRequest(validBody));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    expect(response.status).toBe(200);
  });

  it("TC-03: fast failure path → 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFakeClockWithNoElapsedTime();

    const promise = POST(makeRequest({ email: "invalid-email" }));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
  });

  it("TC-04: elapsed time이 최소 응답 시간을 초과하면 추가 지연 없이 반환한다", async () => {
    mockSlowExecution();
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    mockSignUpSuccess();

    const response = await POST(makeRequest(validBody));

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("TC-05: 최소 응답 시간 적용 후에도 성공 응답 계약이 유지된다", async () => {
    useFakeClockWithNoElapsedTime();
    mockSignUpSuccess();

    const promise = POST(makeRequest(validBody));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "test@example.com",
      redirectTo: ROUTES.LOGIN,
    });
  });

  it("TC-06: 최소 응답 시간 적용 후에도 실패 응답 계약이 유지된다", async () => {
    useFakeClockWithNoElapsedTime();

    const promise = POST(makeRequest({ email: "invalid-email" }));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
    expect(Array.isArray(body.data.errors)).toBe(true);
  });

  it("TC-07: exception path도 동일한 최소 응답 시간 정책을 따른다", async () => {
    useFakeClockWithNoElapsedTime();

    vi.mocked(getUserByEmail).mockRejectedValue(
      new Error("DB connection error"),
    );

    const promise = POST(makeRequest(validBody));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
  });

  it("TC-08: fast rate-limit path도 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFakeClockWithNoElapsedTime();
    mockSignUpSuccess();
    const ip = "127.0.0.1";

    for (let i = 0; i < 10; i++) {
      await resolveAfterMinimumTime(
        POST(
          makeRequestWithIp(
            {
              ...validBody,
              email: `tc08user${i}@example.com`,
            },
            ip,
          ),
        ),
      );
    }

    const promise = POST(
      makeRequestWithIp(
        {
          ...validBody,
          email: "tc08overflow@example.com",
        },
        ip,
      ),
    );

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  });

  it("TC-09: malformed JSON path도 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFakeClockWithNoElapsedTime();

    const promise = POST(makeMalformedJsonRequest());

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
  });
});
