import { describe, expect, it, vi } from "vitest";

import {
  SIGNUP_RESEND_REQUEST_IP_LONG_LIMIT,
  SIGNUP_RESEND_REQUEST_IP_LONG_WINDOW_MS,
  SIGNUP_RESEND_REQUEST_IP_SHORT_LIMIT,
  SIGNUP_RESEND_REQUEST_IP_SHORT_WINDOW_MS,
} from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import { createInMemoryAuthRateLimitStore } from "@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore";

import { createSignupResendRequestRateLimit } from "./signupResendRequestRateLimit";

const BASE_NOW = 1_000_000;
const IP = "203.0.113.10";

describe("signupResendRequestRateLimit", () => {
  it("short window 한도까지 허용하고 다음 요청을 ip_short로 차단한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createSignupResendRequestRateLimit(store);

    for (
      let index = 0;
      index < SIGNUP_RESEND_REQUEST_IP_SHORT_LIMIT;
      index += 1
    ) {
      expect(
        rateLimit.tryConsume({
          ip: IP,
          now: BASE_NOW + index,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      rateLimit.tryConsume({
        ip: IP,
        now: BASE_NOW + SIGNUP_RESEND_REQUEST_IP_SHORT_LIMIT,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });
  });

  it("short window가 지나면 다시 허용한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createSignupResendRequestRateLimit(store);

    for (
      let index = 0;
      index < SIGNUP_RESEND_REQUEST_IP_SHORT_LIMIT;
      index += 1
    ) {
      rateLimit.tryConsume({
        ip: IP,
        now: BASE_NOW + index,
      });
    }

    expect(
      rateLimit.tryConsume({
        ip: IP,
        now:
          BASE_NOW +
          SIGNUP_RESEND_REQUEST_IP_SHORT_WINDOW_MS +
          SIGNUP_RESEND_REQUEST_IP_SHORT_LIMIT,
      }),
    ).toEqual({ allowed: true });
  });

  it("short window를 넘지 않으면서 long window 한도에 도달하면 ip_long으로 차단한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createSignupResendRequestRateLimit(store);
    const intervalMs = 18 * 1000;

    for (
      let index = 0;
      index < SIGNUP_RESEND_REQUEST_IP_LONG_LIMIT;
      index += 1
    ) {
      expect(
        rateLimit.tryConsume({
          ip: IP,
          now: BASE_NOW + index * intervalMs,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      rateLimit.tryConsume({
        ip: IP,
        now: BASE_NOW + SIGNUP_RESEND_REQUEST_IP_LONG_WINDOW_MS,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_long",
    });
  });

  it("long window가 지나면 다시 허용한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createSignupResendRequestRateLimit(store);
    const intervalMs = 18 * 1000;

    for (
      let index = 0;
      index < SIGNUP_RESEND_REQUEST_IP_LONG_LIMIT;
      index += 1
    ) {
      rateLimit.tryConsume({
        ip: IP,
        now: BASE_NOW + index * intervalMs,
      });
    }

    expect(
      rateLimit.tryConsume({
        ip: IP,
        now: BASE_NOW + SIGNUP_RESEND_REQUEST_IP_LONG_WINDOW_MS + 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("blocked 요청은 state를 추가 소비하지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createSignupResendRequestRateLimit(store);

    for (
      let index = 0;
      index < SIGNUP_RESEND_REQUEST_IP_SHORT_LIMIT;
      index += 1
    ) {
      rateLimit.tryConsume({
        ip: IP,
        now: BASE_NOW + index,
      });
    }

    expect(
      rateLimit.tryConsume({
        ip: IP,
        now: BASE_NOW + 10,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });

    expect(
      rateLimit.tryConsume({
        ip: IP,
        now: BASE_NOW + 20,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });

    // blocked 요청이 기록되지 않았다면 가장 오래된 timestamp 하나가
    // short window 밖으로 빠진 시점에 다시 허용된다.
    expect(
      rateLimit.tryConsume({
        ip: IP,
        now: BASE_NOW + SIGNUP_RESEND_REQUEST_IP_SHORT_WINDOW_MS + 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("서로 다른 IP의 quota는 독립적이다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createSignupResendRequestRateLimit(store);

    for (
      let index = 0;
      index < SIGNUP_RESEND_REQUEST_IP_SHORT_LIMIT;
      index += 1
    ) {
      rateLimit.tryConsume({
        ip: IP,
        now: BASE_NOW + index,
      });
    }

    expect(
      rateLimit.tryConsume({
        ip: "203.0.113.20",
        now: BASE_NOW + SIGNUP_RESEND_REQUEST_IP_SHORT_LIMIT,
      }),
    ).toEqual({ allowed: true });
  });

  it("check와 consume을 하나의 runAtomic 구간에서 수행한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const atomicSpy = vi.spyOn(store, "runAtomic");
    const rateLimit = createSignupResendRequestRateLimit(store);

    expect(
      rateLimit.tryConsume({
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({ allowed: true });

    expect(atomicSpy).toHaveBeenCalledTimes(1);
  });
});
