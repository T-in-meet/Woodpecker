import { describe, expect, it } from "vitest";

import {
  OTP_VERIFY_EMAIL_ATTEMPT_LIMIT,
  OTP_VERIFY_EMAIL_ATTEMPT_WINDOW_MS,
  OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS,
  OTP_VERIFY_FAILURE_STREAK_LIMIT,
  OTP_VERIFY_IP_LONG_LIMIT,
  OTP_VERIFY_IP_LONG_WINDOW_MS,
  OTP_VERIFY_IP_SHORT_LIMIT,
  OTP_VERIFY_IP_SHORT_WINDOW_MS,
} from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import type { AuthRateLimitStore } from "@/features/auth/lib/rate-limit/authRateLimitStore";
import { createInMemoryAuthRateLimitStore } from "@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore";

import { createOtpVerifyRateLimit } from "./otpVerifyRateLimit";

const BASE_NOW = 1_000_000;
const EMAIL = "user@example.com";
const IP = "203.0.113.10";
const OTHER_IP = "203.0.113.20";

/**
 * atomic section 내부 실행 여부를 관찰할 Store method 이름.
 */
type AtomicBoundaryStateMethod =
  | "getTimestampWindow"
  | "setTimestampWindow"
  | "deleteTimestampWindow"
  | "getFixedWindow"
  | "setFixedWindow"
  | "deleteFixedWindow"
  | "getFailureStreak"
  | "setFailureStreak"
  | "deleteFailureStreak";

/**
 * atomic boundary에서 관찰한 Store 접근 1건.
 */
type AtomicBoundaryStateCall = {
  method: AtomicBoundaryStateMethod;
  sectionId: number;
};

/**
 * atomic boundary 검증용 Store와 관찰 결과.
 */
type AtomicBoundaryTestStore = {
  store: AuthRateLimitStore;
  getObservedStateCalls(): AtomicBoundaryStateCall[];
};

/**
 * 기존 InMemory Store를 감싸 atomic callback 밖의 OTP Verify state 접근을 실패시킨다.
 *
 * 각 runAtomic invocation에 section ID를 부여해
 * read/check/consume 또는 read-modify-write가 같은 atomic section에서
 * 수행되는지도 직접 관찰한다.
 *
 * @returns atomic boundary 검증용 Store와 관찰 결과
 */
function createAtomicBoundaryTestStore(): AtomicBoundaryTestStore {
  const delegate = createInMemoryAuthRateLimitStore();
  const observedStateCalls: AtomicBoundaryStateCall[] = [];
  let activeAtomicSectionId: number | null = null;
  let nextAtomicSectionId = 1;

  /**
   * OTP Verify state 접근이 현재 runAtomic callback 내부인지 검증하고
   * 어떤 atomic invocation에서 실행됐는지 기록한다.
   *
   * @param method 호출된 Store method 이름
   */
  function observeAtomicStateAccess(method: AtomicBoundaryStateMethod): void {
    if (activeAtomicSectionId === null) {
      throw new Error(`${method} must be called inside runAtomic().`);
    }

    observedStateCalls.push({
      method,
      sectionId: activeAtomicSectionId,
    });
  }

  return {
    store: {
      ...delegate,

      runAtomic<T>(operation: () => T, now?: number): T {
        const sectionId = nextAtomicSectionId;
        nextAtomicSectionId += 1;

        return delegate.runAtomic(() => {
          const previousAtomicSectionId = activeAtomicSectionId;
          activeAtomicSectionId = sectionId;

          try {
            return operation();
          } finally {
            activeAtomicSectionId = previousAtomicSectionId;
          }
        }, now);
      },

      getTimestampWindow(key) {
        observeAtomicStateAccess("getTimestampWindow");
        return delegate.getTimestampWindow(key);
      },

      setTimestampWindow(key, state) {
        observeAtomicStateAccess("setTimestampWindow");
        delegate.setTimestampWindow(key, state);
      },

      deleteTimestampWindow(key) {
        observeAtomicStateAccess("deleteTimestampWindow");
        delegate.deleteTimestampWindow(key);
      },

      getFixedWindow(key) {
        observeAtomicStateAccess("getFixedWindow");
        return delegate.getFixedWindow(key);
      },

      setFixedWindow(key, state) {
        observeAtomicStateAccess("setFixedWindow");
        delegate.setFixedWindow(key, state);
      },

      deleteFixedWindow(key) {
        observeAtomicStateAccess("deleteFixedWindow");
        delegate.deleteFixedWindow(key);
      },

      getFailureStreak(key) {
        observeAtomicStateAccess("getFailureStreak");
        return delegate.getFailureStreak(key);
      },

      setFailureStreak(key, state) {
        observeAtomicStateAccess("setFailureStreak");
        delegate.setFailureStreak(key, state);
      },

      deleteFailureStreak(key) {
        observeAtomicStateAccess("deleteFailureStreak");
        delegate.deleteFailureStreak(key);
      },
    },

    getObservedStateCalls() {
      return [...observedStateCalls];
    },
  };
}

describe("otpVerifyRateLimit", () => {
  it("Email total quota는 purpose별로 독립적이고 limit 이후 차단한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);

    for (let index = 0; index < OTP_VERIFY_EMAIL_ATTEMPT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_total",
    });

    // 같은 canonicalEmail이어도 Recovery purpose Email quota는 독립적이다.
    expect(
      rateLimit.tryStartAttempt({
        purpose: "reset-password",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({ allowed: true });
  });

  it("email_total 차단은 IP attempt를 부분 소비하지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);
    const blockedIp = "203.0.113.20";

    // Email total quota를 먼저 모두 소비한다.
    for (let index = 0; index < OTP_VERIFY_EMAIL_ATTEMPT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }

    // 새로운 IP에서 시도해도 Email total 때문에 차단된다.
    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: blockedIp,
        now: BASE_NOW,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_total",
    });

    // 위 차단 요청이 IP quota를 소비하지 않았다면
    // 새 IP는 short limit 전체 횟수를 그대로 사용할 수 있다.
    for (let index = 0; index < OTP_VERIFY_IP_SHORT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: `ip-check-${index}@example.com`,
          ip: blockedIp,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: "ip-blocked@example.com",
        ip: blockedIp,
        now: BASE_NOW,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });
  });

  it("Email total fixed window는 정확히 10분 경계에서 새 window를 시작한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);

    for (let index = 0; index < OTP_VERIFY_EMAIL_ATTEMPT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + OTP_VERIFY_EMAIL_ATTEMPT_WINDOW_MS - 1,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_total",
    });

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + OTP_VERIFY_EMAIL_ATTEMPT_WINDOW_MS,
      }),
    ).toEqual({ allowed: true });
  });

  it("IP short quota는 signup/reset-password가 공유하고 차단 요청은 Email quota를 소비하지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);

    for (let index = 0; index < OTP_VERIFY_IP_SHORT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: index % 2 === 0 ? "signup" : "reset-password",
          canonicalEmail: `short-${index}@example.com`,
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }

    const blockedEmail = "short-blocked@example.com";

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: blockedEmail,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });

    // IP blocker에서 Email fixed-window state가 부분 소비되지 않아야 한다.
    for (let index = 0; index < OTP_VERIFY_EMAIL_ATTEMPT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: blockedEmail,
          ip: OTHER_IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }
  });

  it("IP short quota는 정확히 1분 경계의 timestamp를 아직 유효하게 취급한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);

    for (let index = 0; index < OTP_VERIFY_IP_SHORT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: `short-boundary-${index}@example.com`,
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: "short-boundary-blocked@example.com",
        ip: IP,
        now: BASE_NOW + OTP_VERIFY_IP_SHORT_WINDOW_MS,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: "short-boundary-blocked@example.com",
        ip: IP,
        now: BASE_NOW + OTP_VERIFY_IP_SHORT_WINDOW_MS + 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("IP long quota는 shared rolling 15분 window와 exact boundary를 사용한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);
    const interval = OTP_VERIFY_IP_LONG_WINDOW_MS / OTP_VERIFY_IP_LONG_LIMIT;

    for (let index = 0; index < OTP_VERIFY_IP_LONG_LIMIT; index += 1) {
      const now = BASE_NOW + index * interval;

      expect(
        rateLimit.tryStartAttempt({
          purpose: index % 2 === 0 ? "signup" : "reset-password",
          canonicalEmail: `long-${index}@example.com`,
          ip: IP,
          now,
        }),
      ).toEqual({ allowed: true });
    }

    // timestamp === now - windowMs는 현재 sliding-window 규칙상 유효하다.
    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: "long-blocked@example.com",
        ip: IP,
        now: BASE_NOW + OTP_VERIFY_IP_LONG_WINDOW_MS,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_long",
    });

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: "long-blocked@example.com",
        ip: IP,
        now: BASE_NOW + OTP_VERIFY_IP_LONG_WINDOW_MS + 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("ip_long 차단은 Email total을 부분 소비하지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);
    const targetEmail = "ip-long-target@example.com";
    const freshIp = "203.0.113.20";
    const intervalMs = OTP_VERIFY_IP_LONG_WINDOW_MS / OTP_VERIFY_IP_LONG_LIMIT;

    // IP short에는 걸리지 않도록 분산하면서 long quota를 모두 소비한다.
    for (let index = 0; index < OTP_VERIFY_IP_LONG_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: `long-${index}@example.com`,
          ip: IP,
          now: BASE_NOW + index * intervalMs,
        }),
      ).toEqual({ allowed: true });
    }

    const blockedAt = BASE_NOW + OTP_VERIFY_IP_LONG_WINDOW_MS;

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: targetEmail,
        ip: IP,
        now: blockedAt,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_long",
    });

    // ip_long 차단이 Email total을 소비하지 않았다면
    // 다른 IP에서는 Email quota 전체 횟수를 그대로 사용할 수 있다.
    for (let index = 0; index < OTP_VERIFY_EMAIL_ATTEMPT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: targetEmail,
          ip: freshIp,
          now: blockedAt,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: targetEmail,
        ip: freshIp,
        now: blockedAt,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_total",
    });
  });

  it("OTP failure streak는 purpose와 무관하게 canonicalEmail 기준으로 공유된다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);

    for (let index = 0; index < OTP_VERIFY_FAILURE_STREAK_LIMIT; index += 1) {
      rateLimit.recordResult({
        canonicalEmail: EMAIL,
        outcome: "otp_failure",
        now: BASE_NOW + index,
      });
    }

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + OTP_VERIFY_FAILURE_STREAK_LIMIT,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "failure_streak",
    });

    expect(
      rateLimit.tryStartAttempt({
        purpose: "reset-password",
        canonicalEmail: EMAIL,
        ip: OTHER_IP,
        now: BASE_NOW + OTP_VERIFY_FAILURE_STREAK_LIMIT,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "failure_streak",
    });
  });

  it("failure streak는 정확히 10분 inactivity 경계에서 만료된다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);

    for (let index = 0; index < OTP_VERIFY_FAILURE_STREAK_LIMIT; index += 1) {
      rateLimit.recordResult({
        canonicalEmail: EMAIL,
        outcome: "otp_failure",
        now: BASE_NOW,
      });
    }

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS - 1,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "failure_streak",
    });

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS,
      }),
    ).toEqual({ allowed: true });
  });

  it("inactivity 경계 이후 첫 OTP failure는 새 streak를 count 1부터 시작한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);

    // 기존 streak를 차단 한도까지 채운다.
    for (let index = 0; index < OTP_VERIFY_FAILURE_STREAK_LIMIT; index += 1) {
      rateLimit.recordResult({
        canonicalEmail: EMAIL,
        outcome: "otp_failure",
        now: BASE_NOW,
      });
    }

    const restartedAt = BASE_NOW + OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS;

    // 정확한 inactivity 경계 이후 첫 failure는 stale count를 이어받지 않는다.
    rateLimit.recordResult({
      canonicalEmail: EMAIL,
      outcome: "otp_failure",
      now: restartedAt,
    });

    // 새 streak를 총 4회까지 채운다.
    for (
      let index = 1;
      index < OTP_VERIFY_FAILURE_STREAK_LIMIT - 1;
      index += 1
    ) {
      rateLimit.recordResult({
        canonicalEmail: EMAIL,
        outcome: "otp_failure",
        now: restartedAt + index,
      });
    }

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: restartedAt + OTP_VERIFY_FAILURE_STREAK_LIMIT,
      }),
    ).toEqual({ allowed: true });

    // 새 streak의 5번째 failure부터 다시 차단된다.
    rateLimit.recordResult({
      canonicalEmail: EMAIL,
      outcome: "otp_failure",
      now: restartedAt + OTP_VERIFY_FAILURE_STREAK_LIMIT + 1,
    });

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: restartedAt + OTP_VERIFY_FAILURE_STREAK_LIMIT + 2,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "failure_streak",
    });
  });

  it("Provider rate-limit/system outcome은 failure streak를 증가시키거나 clear하지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);

    for (
      let index = 0;
      index < OTP_VERIFY_FAILURE_STREAK_LIMIT - 1;
      index += 1
    ) {
      rateLimit.recordResult({
        canonicalEmail: EMAIL,
        outcome: "otp_failure",
        now: BASE_NOW + index,
      });
    }

    rateLimit.recordResult({
      canonicalEmail: EMAIL,
      outcome: "provider_rate_limited",
      now: BASE_NOW + 10,
    });
    rateLimit.recordResult({
      canonicalEmail: EMAIL,
      outcome: "provider_error",
      now: BASE_NOW + 11,
    });

    // Provider 계열 결과가 count를 늘리지 않았다면 아직 한 번은 시작 가능하다.
    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + 12,
      }),
    ).toEqual({ allowed: true });

    rateLimit.recordResult({
      canonicalEmail: EMAIL,
      outcome: "otp_failure",
      now: BASE_NOW + 13,
    });

    expect(
      rateLimit.tryStartAttempt({
        purpose: "reset-password",
        canonicalEmail: EMAIL,
        ip: OTHER_IP,
        now: BASE_NOW + 14,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "failure_streak",
    });
  });

  it.each(["provider_rate_limited", "provider_error"] as const)(
    "%s는 failure streak inactivity 기준 시각을 갱신하지 않는다",
    (outcome) => {
      const store = createInMemoryAuthRateLimitStore();
      const rateLimit = createOtpVerifyRateLimit(store);

      // 마지막 countable OTP failure 시각을 BASE_NOW로 고정한다.
      for (let index = 0; index < OTP_VERIFY_FAILURE_STREAK_LIMIT; index += 1) {
        rateLimit.recordResult({
          canonicalEmail: EMAIL,
          outcome: "otp_failure",
          now: BASE_NOW,
        });
      }

      // Provider 계열 결과가 만료 직전에 발생해도 inactivity 기준 시각은 바뀌지 않는다.
      rateLimit.recordResult({
        canonicalEmail: EMAIL,
        outcome,
        now: BASE_NOW + OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS - 1,
      });

      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip: IP,
          now: BASE_NOW + OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS,
        }),
      ).toEqual({ allowed: true });
    },
  );

  it("success는 failure streak만 clear하고 이미 소비된 Email/IP attempt는 유지한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);

    // 동일 Email quota를 모두 소비한다.
    for (let index = 0; index < OTP_VERIFY_EMAIL_ATTEMPT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }

    // 동일 IP short quota도 총 limit까지 소비한다.
    for (
      let index = OTP_VERIFY_EMAIL_ATTEMPT_LIMIT;
      index < OTP_VERIFY_IP_SHORT_LIMIT;
      index += 1
    ) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: `success-ip-${index}@example.com`,
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }

    rateLimit.recordResult({
      canonicalEmail: EMAIL,
      outcome: "otp_failure",
      now: BASE_NOW,
    });
    rateLimit.recordResult({
      canonicalEmail: EMAIL,
      outcome: "success",
      now: BASE_NOW,
    });

    // success가 Email total attempt를 reset하지 않는다.
    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: OTHER_IP,
        now: BASE_NOW,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_total",
    });

    // success가 shared IP attempt도 reset하지 않는다.
    expect(
      rateLimit.tryStartAttempt({
        purpose: "reset-password",
        canonicalEmail: "fresh-after-success@example.com",
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });
  });

  it("success는 차단 중인 shared failure streak를 clear한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);

    for (let index = 0; index < OTP_VERIFY_FAILURE_STREAK_LIMIT; index += 1) {
      rateLimit.recordResult({
        canonicalEmail: EMAIL,
        outcome: "otp_failure",
        now: BASE_NOW,
      });
    }

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + 1,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "failure_streak",
    });

    rateLimit.recordResult({
      canonicalEmail: EMAIL,
      outcome: "success",
      now: BASE_NOW + 2,
    });

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + 3,
      }),
    ).toEqual({ allowed: true });
  });

  it("failure streak blocker는 Email/IP attempt를 부분 소비하지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpVerifyRateLimit(store);

    for (let index = 0; index < OTP_VERIFY_FAILURE_STREAK_LIMIT; index += 1) {
      rateLimit.recordResult({
        canonicalEmail: EMAIL,
        outcome: "otp_failure",
        now: BASE_NOW,
      });
    }

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "failure_streak",
    });

    rateLimit.recordResult({
      canonicalEmail: EMAIL,
      outcome: "success",
      now: BASE_NOW,
    });

    // 차단 요청이 Email quota를 소비하지 않았다면 정확히 limit회 허용된다.
    for (let index = 0; index < OTP_VERIFY_EMAIL_ATTEMPT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip: OTHER_IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }

    // 위 Email 검증은 OTHER_IP를 사용했으므로, 최초 차단의 IP 소비 여부를 독립 검증한다.
    for (let index = 0; index < OTP_VERIFY_IP_SHORT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "reset-password",
          canonicalEmail: `partial-ip-${index}@example.com`,
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }
  });

  it("tryStartAttempt의 check + consume은 동일한 runAtomic 안에서 수행되고 동일 시각 호출이 limit을 넘지 않는다", () => {
    const observation = createAtomicBoundaryTestStore();
    const rateLimit = createOtpVerifyRateLimit(observation.store);

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({ allowed: true });

    const firstAttemptCalls = observation.getObservedStateCalls();

    // 첫 allowed attempt의 read/check/consume Store 접근은 모두 같은 atomic invocation에 속한다.
    expect(new Set(firstAttemptCalls.map((call) => call.sectionId)).size).toBe(
      1,
    );

    // 첫 시도를 포함해 정확히 Email limit까지 허용한다.
    for (let index = 1; index < OTP_VERIFY_EMAIL_ATTEMPT_LIMIT; index += 1) {
      expect(
        rateLimit.tryStartAttempt({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      rateLimit.tryStartAttempt({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_total",
    });
  });

  it("recordResult의 OTP failure read-modify-write는 동일한 runAtomic 안에서 수행하고 success clear도 atomic하게 수행한다", () => {
    const observation = createAtomicBoundaryTestStore();
    const rateLimit = createOtpVerifyRateLimit(observation.store);

    rateLimit.recordResult({
      canonicalEmail: EMAIL,
      outcome: "otp_failure",
      now: BASE_NOW,
    });

    const failureCalls = observation.getObservedStateCalls();

    expect(failureCalls.map((call) => call.method)).toEqual([
      "getFailureStreak",
      "setFailureStreak",
    ]);
    expect(new Set(failureCalls.map((call) => call.sectionId)).size).toBe(1);

    const failureSectionId = failureCalls[0]?.sectionId;

    rateLimit.recordResult({
      canonicalEmail: EMAIL,
      outcome: "success",
      now: BASE_NOW + 1,
    });

    const allCalls = observation.getObservedStateCalls();
    const successCall = allCalls.at(-1);

    expect(successCall?.method).toBe("deleteFailureStreak");
    expect(successCall?.sectionId).not.toBe(failureSectionId);
  });
});
