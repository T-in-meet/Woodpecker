import { beforeEach, describe, expect, it } from "vitest";

import {
  LOGIN_EMAIL_ATTEMPT_LIMIT,
  LOGIN_EMAIL_ATTEMPT_WINDOW_MS,
  LOGIN_FAILURE_STREAK_INACTIVITY_MS,
  LOGIN_FAILURE_STREAK_LIMIT,
  LOGIN_IP_LONG_LIMIT,
  LOGIN_IP_SHORT_LIMIT,
  LOGIN_IP_SHORT_WINDOW_MS,
} from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import type { AuthRateLimitStore } from "@/features/auth/lib/rate-limit/authRateLimitStore";
import { createInMemoryAuthRateLimitStore } from "@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore";

import { createLoginRateLimit } from "./loginRateLimit";

/**
 * Password Login Rate Limit 테스트 기준 시각.
 */
const BASE_TIME = new Date("2026-01-01T00:00:00.000Z").getTime();

/**
 * 테스트 canonical email.
 */
const TEST_EMAIL = "user@example.com";

/**
 * 테스트 사용자 IP.
 */
const TEST_IP = "203.0.113.10";

/**
 * Login Email attempt Store key를 생성한다.
 *
 * @param email canonical email
 * @returns Store key
 */
function emailAttemptKey(email: string): string {
  return `auth:login:email:attempt:${email}`;
}

/**
 * Login IP attempt Store key를 생성한다.
 *
 * @param ip 사용자 IP
 * @returns Store key
 */
function ipAttemptKey(ip: string): string {
  return `auth:login:ip:attempt:${ip}`;
}

/**
 * Login failure streak Store key를 생성한다.
 *
 * @param email canonical email
 * @returns Store key
 */
function failureStreakKey(email: string): string {
  return `auth:login:email:failure-streak:${email}`;
}

describe("createLoginRateLimit", () => {
  let store: AuthRateLimitStore;
  let rateLimit: ReturnType<typeof createLoginRateLimit>;

  beforeEach(() => {
    store = createInMemoryAuthRateLimitStore();
    rateLimit = createLoginRateLimit(store);
  });

  it("허용된 attempt는 Email과 IP를 함께 소비한다", () => {
    const result = rateLimit.tryStartAttempt({
      canonicalEmail: TEST_EMAIL,
      ip: TEST_IP,
      now: BASE_TIME,
    });

    expect(result).toEqual({ allowed: true });

    expect(
      store.getTimestampWindow(emailAttemptKey(TEST_EMAIL)),
    ).toEqual([BASE_TIME]);

    expect(store.getTimestampWindow(ipAttemptKey(TEST_IP))).toEqual([
      BASE_TIME,
    ]);
  });

  it("Email은 rolling 10회 / 5분 제한을 적용한다", () => {
    for (let index = 0; index < LOGIN_EMAIL_ATTEMPT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          canonicalEmail: TEST_EMAIL,
          ip: TEST_IP,
          now: BASE_TIME,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      rateLimit.tryStartAttempt({
        canonicalEmail: TEST_EMAIL,
        ip: TEST_IP,
        now: BASE_TIME,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_attempt",
    });

    // rolling window가 지난 뒤에는 오래된 attempt가 제거되어 다시 허용된다.
    expect(
      rateLimit.tryStartAttempt({
        canonicalEmail: TEST_EMAIL,
        ip: TEST_IP,
        now: BASE_TIME + LOGIN_EMAIL_ATTEMPT_WINDOW_MS + 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("IP short는 rolling 20회 / 1분 제한을 적용한다", () => {
    for (let index = 0; index < LOGIN_IP_SHORT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          canonicalEmail: `user${index}@example.com`,
          ip: TEST_IP,
          now: BASE_TIME,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      rateLimit.tryStartAttempt({
        canonicalEmail: "blocked@example.com",
        ip: TEST_IP,
        now: BASE_TIME,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });

    expect(
      rateLimit.tryStartAttempt({
        canonicalEmail: "after-window@example.com",
        ip: TEST_IP,
        now: BASE_TIME + LOGIN_IP_SHORT_WINDOW_MS + 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("IP long은 rolling 100회 / 15분 제한을 적용한다", () => {
    // 1분 short limit에는 걸리지 않도록 8초 간격으로 분산한다.
    const intervalMs = 8 * 1000;

    for (let index = 0; index < LOGIN_IP_LONG_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          canonicalEmail: `long${index}@example.com`,
          ip: TEST_IP,
          now: BASE_TIME + index * intervalMs,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      rateLimit.tryStartAttempt({
        canonicalEmail: "long-blocked@example.com",
        ip: TEST_IP,
        now: BASE_TIME + LOGIN_IP_LONG_LIMIT * intervalMs,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_long",
    });
  });

  it("하나의 조건이 차단되면 다른 state를 부분적으로 소비하지 않는다", () => {
    for (let index = 0; index < LOGIN_EMAIL_ATTEMPT_LIMIT; index += 1) {
      rateLimit.tryStartAttempt({
        canonicalEmail: TEST_EMAIL,
        ip: TEST_IP,
        now: BASE_TIME,
      });
    }

    const otherIp = "203.0.113.20";

    expect(
      rateLimit.tryStartAttempt({
        canonicalEmail: TEST_EMAIL,
        ip: otherIp,
        now: BASE_TIME,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_attempt",
    });

    // Email 차단 때문에 Provider가 시작되지 않았으므로 새 IP도 소비되지 않는다.
    expect(
      store.getTimestampWindow(ipAttemptKey(otherIp)),
    ).toBeUndefined();
  });

  it("5회의 consecutive credential failure 이후 새 attempt를 차단한다", () => {
    for (
      let index = 0;
      index < LOGIN_FAILURE_STREAK_LIMIT;
      index += 1
    ) {
      const now = BASE_TIME + index * 1000;

      expect(
        rateLimit.tryStartAttempt({
          canonicalEmail: TEST_EMAIL,
          ip: TEST_IP,
          now,
        }),
      ).toEqual({ allowed: true });

      rateLimit.recordResult({
        canonicalEmail: TEST_EMAIL,
        result: "credential_failure",
        now,
      });
    }

    expect(
      rateLimit.tryStartAttempt({
        canonicalEmail: TEST_EMAIL,
        ip: TEST_IP,
        now: BASE_TIME + LOGIN_FAILURE_STREAK_LIMIT * 1000,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "failure_streak",
    });
  });

  it("failure streak 차단은 Email/IP attempt를 추가 소비하지 않는다", () => {
    for (
      let index = 0;
      index < LOGIN_FAILURE_STREAK_LIMIT;
      index += 1
    ) {
      const now = BASE_TIME + index * 1000;

      rateLimit.tryStartAttempt({
        canonicalEmail: TEST_EMAIL,
        ip: TEST_IP,
        now,
      });

      rateLimit.recordResult({
        canonicalEmail: TEST_EMAIL,
        result: "credential_failure",
        now,
      });
    }

    const emailBefore =
      store.getTimestampWindow(emailAttemptKey(TEST_EMAIL)) ?? [];
    const ipBefore =
      store.getTimestampWindow(ipAttemptKey(TEST_IP)) ?? [];

    rateLimit.tryStartAttempt({
      canonicalEmail: TEST_EMAIL,
      ip: TEST_IP,
      now: BASE_TIME + 10_000,
    });

    expect(
      store.getTimestampWindow(emailAttemptKey(TEST_EMAIL)),
    ).toEqual(emailBefore);

    expect(store.getTimestampWindow(ipAttemptKey(TEST_IP))).toEqual(
      ipBefore,
    );
  });

  it("Password Login 성공은 failure streak를 clear한다", () => {
    for (let index = 0; index < 4; index += 1) {
      rateLimit.recordResult({
        canonicalEmail: TEST_EMAIL,
        result: "credential_failure",
        now: BASE_TIME + index * 1000,
      });
    }

    expect(
      store.getFailureStreak(failureStreakKey(TEST_EMAIL)),
    ).toEqual({
      count: 4,
      lastFailureAt: BASE_TIME + 3_000,
    });

    rateLimit.recordResult({
      canonicalEmail: TEST_EMAIL,
      result: "success",
      now: BASE_TIME + 4_000,
    });

    expect(
      store.getFailureStreak(failureStreakKey(TEST_EMAIL)),
    ).toBeUndefined();
  });

  it("5분 inactivity가 지나면 기존 failure streak를 만료된 것으로 처리한다", () => {
    const lastFailureAt = BASE_TIME;

    for (let index = 0; index < LOGIN_FAILURE_STREAK_LIMIT; index += 1) {
      rateLimit.recordResult({
        canonicalEmail: TEST_EMAIL,
        result: "credential_failure",
        now: lastFailureAt,
      });
    }

    expect(
      rateLimit.tryStartAttempt({
        canonicalEmail: TEST_EMAIL,
        ip: TEST_IP,
        now:
          lastFailureAt + LOGIN_FAILURE_STREAK_INACTIVITY_MS,
      }),
    ).toEqual({ allowed: true });

    // 새 Provider operation이 허용되면서 stale streak도 정리된다.
    expect(
      store.getFailureStreak(failureStreakKey(TEST_EMAIL)),
    ).toBeUndefined();

    rateLimit.recordResult({
      canonicalEmail: TEST_EMAIL,
      result: "credential_failure",
      now:
        lastFailureAt +
        LOGIN_FAILURE_STREAK_INACTIVITY_MS +
        1,
    });

    expect(
      store.getFailureStreak(failureStreakKey(TEST_EMAIL)),
    ).toEqual({
      count: 1,
      lastFailureAt:
        lastFailureAt +
        LOGIN_FAILURE_STREAK_INACTIVITY_MS +
        1,
    });
  });

  it("non-credential Provider 결과는 total/IP는 유지하고 streak는 변경하지 않는다", () => {
    rateLimit.recordResult({
      canonicalEmail: TEST_EMAIL,
      result: "credential_failure",
      now: BASE_TIME,
    });

    const streakBefore = store.getFailureStreak(
      failureStreakKey(TEST_EMAIL),
    );

    expect(
      rateLimit.tryStartAttempt({
        canonicalEmail: TEST_EMAIL,
        ip: TEST_IP,
        now: BASE_TIME + 1000,
      }),
    ).toEqual({ allowed: true });

    rateLimit.recordResult({
      canonicalEmail: TEST_EMAIL,
      result: "non_credential_failure",
      now: BASE_TIME + 1000,
    });

    expect(
      store.getTimestampWindow(emailAttemptKey(TEST_EMAIL)),
    ).toHaveLength(1);

    expect(store.getTimestampWindow(ipAttemptKey(TEST_IP))).toHaveLength(
      1,
    );

    expect(
      store.getFailureStreak(failureStreakKey(TEST_EMAIL)),
    ).toEqual(streakBefore);
  });

  it("동시 진입 형태에서도 Email check+consume이 한도를 초과하지 않는다", async () => {
    const results = await Promise.all(
      Array.from(
        { length: LOGIN_EMAIL_ATTEMPT_LIMIT + 1 },
        async () =>
          rateLimit.tryStartAttempt({
            canonicalEmail: TEST_EMAIL,
            ip: TEST_IP,
            now: BASE_TIME,
          }),
      ),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(
      LOGIN_EMAIL_ATTEMPT_LIMIT,
    );

    expect(
      results.filter((result) => !result.allowed),
    ).toHaveLength(1);

    expect(
      store.getTimestampWindow(emailAttemptKey(TEST_EMAIL)),
    ).toHaveLength(LOGIN_EMAIL_ATTEMPT_LIMIT);

    expect(store.getTimestampWindow(ipAttemptKey(TEST_IP))).toHaveLength(
      LOGIN_EMAIL_ATTEMPT_LIMIT,
    );
  });
});
