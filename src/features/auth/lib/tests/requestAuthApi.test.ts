/**
 * requestAuthApi 단위 테스트
 *
 * 검증 범위:
 * - 응답 헤더는 왔지만 body가 끝나지 않는 경우에도 시간 초과로 끊는지
 *
 * transport 실패를 GlobalError로 좁히는 나머지 경로(network / server / 응답 없음)는
 * loginMutation·signupMutation 테스트가 호출부 계약까지 함께 검증한다. 여기서는
 * fetch가 resolve된 뒤에야 드러나는 경로만 직접 다룬다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestAuthApi } from "../requestAuthApi";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const init: RequestInit = {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "user@example.com" }),
};

describe("requestAuthApi", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("헤더만 오고 body가 끝나지 않으면 timeout GlobalError로 좁혀서 throw한다", async () => {
    vi.useFakeTimers();

    // 프록시가 200 헤더만 보내고 chunked body를 끝내지 않는 상황.
    // fetch는 헤더만 오면 resolve하므로, 타이머가 body 읽기까지 덮지 않으면
    // 폼이 "로그인 중..."에 영원히 묶인다.
    mockFetch.mockImplementation((_url: string, requestInit: RequestInit) =>
      Promise.resolve({
        ok: true,
        json: () =>
          new Promise((_resolve, reject) => {
            requestInit.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      }),
    );

    const rejected = requestAuthApi("/api/auth/login", init).catch(
      (e: unknown) => e,
    );

    await vi.advanceTimersByTimeAsync(15_000);

    expect(await rejected).toEqual({ type: "timeout" });
  });
});
