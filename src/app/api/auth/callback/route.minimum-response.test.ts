/**
 * 이메일 callback API 최소 응답 시간 보장 테스트
 *
 * 목적:
 * - callback 분기별 처리 차이가 외부 응답 시간으로 노출되지 않도록 검증
 * - 모든 경로가 최소 응답 시간(MIN_RESPONSE_MS) 이후에만 응답하는지 확인
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { decryptTicket } from "@/features/auth/email/ticket";
import { MIN_RESPONSE_MS } from "@/features/auth/lib/applyMinimumResponseTime";
import { createClient } from "@/lib/supabase/server";

import { GET } from "./route";

vi.mock("@/lib/supabase/server");
vi.mock("@/features/auth/email/ticket");

const START_TIME = 1_000_000;
const mockVerifyOtp = vi.fn();

function makeRequest(ticket?: string): NextRequest {
  const url = new URL("http://localhost/api/auth/callback");
  if (ticket !== undefined) {
    url.searchParams.set("ticket", ticket);
  }
  return new NextRequest(url.toString(), { method: "GET" });
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

function useFastPathClock() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(START_TIME));
}

function mockSlowExecution() {
  vi.spyOn(Date, "now")
    .mockReturnValueOnce(START_TIME)
    .mockReturnValue(START_TIME + MIN_RESPONSE_MS + 500);
}

describe("callback 최소 응답 시간 보장", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();

    vi.mocked(createClient).mockResolvedValue({
      auth: { verifyOtp: mockVerifyOtp },
    } as never);

    vi.mocked(decryptTicket).mockReturnValue("signup:token-hash-xyz");
    mockVerifyOtp.mockResolvedValue({ data: { user: null }, error: null });
  });

  it("TC-01: ticket 누락 빠른 경로도 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFastPathClock();

    const promise = GET(makeRequest());

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    expect(response.status).toBe(307);
  });

  it("TC-02: notify 경로(verifyOtp 미호출)도 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFastPathClock();
    vi.mocked(decryptTicket).mockReturnValue("notify-anything");

    const promise = GET(makeRequest("opaque-ticket"));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    expect(response.status).toBe(307);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(0);
  });

  it("TC-03: verifyOtp 성공 경로도 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFastPathClock();

    const promise = GET(makeRequest("opaque-ticket"));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    expect(response.status).toBe(307);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
  });

  it("TC-04: decrypt 실패 경로도 최소 응답 시간 이전에 응답하지 않는다", async () => {
    useFastPathClock();
    vi.mocked(decryptTicket).mockImplementation(() => {
      throw new Error("invalid ticket");
    });

    const promise = GET(makeRequest("bad-ticket"));

    await expectPendingUntilMinimumTime(promise);

    const response = await promise;
    expect(response.status).toBe(307);
  });

  it("TC-05: 경과 시간이 이미 최소 응답 시간을 넘으면 추가 지연 없이 반환한다", async () => {
    mockSlowExecution();
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");

    const response = await GET(makeRequest("opaque-ticket"));

    expect(response.status).toBe(307);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});
