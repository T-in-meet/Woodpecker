import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_GLOBAL_REQUEST_IP_LONG_LIMIT,
  AUTH_GLOBAL_REQUEST_IP_LONG_WINDOW_MS,
  AUTH_GLOBAL_REQUEST_IP_SHORT_LIMIT,
  AUTH_GLOBAL_REQUEST_IP_SHORT_WINDOW_MS,
} from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import type { AuthRateLimitStore } from "@/features/auth/lib/rate-limit/authRateLimitStore";
import { createInMemoryAuthRateLimitStore } from "@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore";

import { createAuthGlobalRequestRateLimit } from "./authGlobalRequestRateLimit";

/**
 * Auth Global Rate Limit 테스트 기준 시각.
 */
const BASE_TIME = new Date("2026-01-01T00:00:00.000Z").getTime();

/**
 * 테스트 사용자 IP.
 */
const TEST_IP = "203.0.113.10";

/**
 * 별도 사용자 IP.
 */
const OTHER_IP = "203.0.113.20";

/**
 * Global long-window 테스트 요청 간격.
 *
 * 150회를 15분에 분산하면서 short 30 / 1분에는 걸리지 않도록 한다.
 */
const LONG_WINDOW_INTERVAL_MS =
  AUTH_GLOBAL_REQUEST_IP_LONG_WINDOW_MS / AUTH_GLOBAL_REQUEST_IP_LONG_LIMIT;

/**
 * Auth Global shared IP request Store key를 생성한다.
 *
 * @param ip 사용자 IP
 * @returns Store key
 */
function globalRequestIpKey(ip: string): string {
  return `auth:global:request:ip:${ip}`;
}

describe("createAuthGlobalRequestRateLimit", () => {
  let store: AuthRateLimitStore;
  let rateLimit: ReturnType<typeof createAuthGlobalRequestRateLimit>;

  beforeEach(() => {
    store = createInMemoryAuthRateLimitStore();
    rateLimit = createAuthGlobalRequestRateLimit(store);
  });

  it("허용된 request는 shared IP budget을 1회 소비한다", () => {
    expect(
      rateLimit.tryConsume({
        ip: TEST_IP,
        now: BASE_TIME,
      }),
    ).toEqual({ allowed: true });

    expect(store.getTimestampWindow(globalRequestIpKey(TEST_IP))).toEqual([
      BASE_TIME,
    ]);
  });

  it("short는 30회까지 허용하고 31번째 request를 차단한다", () => {
    for (
      let index = 0;
      index < AUTH_GLOBAL_REQUEST_IP_SHORT_LIMIT;
      index += 1
    ) {
      expect(
        rateLimit.tryConsume({
          ip: TEST_IP,
          now: BASE_TIME,
        }),
      ).toEqual({ allowed: true });
    }

    const beforeBlocked =
      store.getTimestampWindow(globalRequestIpKey(TEST_IP)) ?? [];

    expect(
      rateLimit.tryConsume({
        ip: TEST_IP,
        now: BASE_TIME,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });

    // 차단된 request는 global budget을 추가 소비하지 않는다.
    expect(store.getTimestampWindow(globalRequestIpKey(TEST_IP))).toEqual(
      beforeBlocked,
    );

    // short window가 지난 뒤에는 오래된 request가 prune되어 다시 허용된다.
    expect(
      rateLimit.tryConsume({
        ip: TEST_IP,
        now: BASE_TIME + AUTH_GLOBAL_REQUEST_IP_SHORT_WINDOW_MS + 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("long은 short를 피해서 150회까지 허용하고 151번째 request를 차단한다", () => {
    for (let index = 0; index < AUTH_GLOBAL_REQUEST_IP_LONG_LIMIT; index += 1) {
      expect(
        rateLimit.tryConsume({
          ip: TEST_IP,
          now: BASE_TIME + index * LONG_WINDOW_INTERVAL_MS,
        }),
      ).toEqual({ allowed: true });
    }

    const blockedAt =
      BASE_TIME + AUTH_GLOBAL_REQUEST_IP_LONG_LIMIT * LONG_WINDOW_INTERVAL_MS;

    expect(
      rateLimit.tryConsume({
        ip: TEST_IP,
        now: blockedAt,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_long",
    });

    expect(store.getTimestampWindow(globalRequestIpKey(TEST_IP))).toHaveLength(
      AUTH_GLOBAL_REQUEST_IP_LONG_LIMIT,
    );
  });

  it("서로 다른 IP는 global state를 공유하지 않는다", () => {
    for (
      let index = 0;
      index < AUTH_GLOBAL_REQUEST_IP_SHORT_LIMIT;
      index += 1
    ) {
      rateLimit.tryConsume({
        ip: TEST_IP,
        now: BASE_TIME,
      });
    }

    expect(
      rateLimit.tryConsume({
        ip: TEST_IP,
        now: BASE_TIME,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });

    expect(
      rateLimit.tryConsume({
        ip: OTHER_IP,
        now: BASE_TIME,
      }),
    ).toEqual({ allowed: true });

    expect(store.getTimestampWindow(globalRequestIpKey(OTHER_IP))).toEqual([
      BASE_TIME,
    ]);
  });

  it("short와 long은 같은 timestamp collection을 공유한다", () => {
    const firstNow = BASE_TIME;
    const secondNow = BASE_TIME + AUTH_GLOBAL_REQUEST_IP_SHORT_WINDOW_MS + 1;

    expect(
      rateLimit.tryConsume({
        ip: TEST_IP,
        now: firstNow,
      }),
    ).toEqual({ allowed: true });

    expect(
      rateLimit.tryConsume({
        ip: TEST_IP,
        now: secondNow,
      }),
    ).toEqual({ allowed: true });

    // 첫 request는 short에서는 만료됐지만 long 상태에는 함께 보존된다.
    expect(store.getTimestampWindow(globalRequestIpKey(TEST_IP))).toEqual([
      firstNow,
      secondNow,
    ]);
  });

  it("연속된 LIMIT+1회 호출에서도 short 허용 수가 limit을 넘지 않는다", () => {
    const results = Array.from(
      { length: AUTH_GLOBAL_REQUEST_IP_SHORT_LIMIT + 1 },
      () =>
        rateLimit.tryConsume({
          ip: TEST_IP,
          now: BASE_TIME,
        }),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(
      AUTH_GLOBAL_REQUEST_IP_SHORT_LIMIT,
    );

    expect(results.filter((result) => !result.allowed)).toHaveLength(1);

    expect(store.getTimestampWindow(globalRequestIpKey(TEST_IP))).toHaveLength(
      AUTH_GLOBAL_REQUEST_IP_SHORT_LIMIT,
    );
  });

  it("request 1회 consume을 하나의 runAtomic 구간에서 처리한다", () => {
    const runAtomicSpy = vi.spyOn(store, "runAtomic");

    expect(
      rateLimit.tryConsume({
        ip: TEST_IP,
        now: BASE_TIME,
      }),
    ).toEqual({ allowed: true });

    expect(runAtomicSpy).toHaveBeenCalledTimes(1);
  });
});
