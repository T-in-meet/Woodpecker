import { describe, expect, it } from "vitest";

import { createLoginRateLimit } from "@/features/auth/login/lib/loginRateLimit";

import { createAuthGlobalRequestRateLimit } from "./authGlobalRequestRateLimit";
import { createInMemoryAuthRateLimitStore } from "./inMemoryAuthRateLimitStore";
import { createOtpIssueRateLimit } from "./otpIssueRateLimit";
import { createOtpVerifyRateLimit } from "./otpVerifyRateLimit";

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z").getTime();
const TEST_IP = "203.0.113.10";
const OTHER_IP = "203.0.113.20";

type Operation = "login" | "otp_issue" | "otp_verify";

function createHarness() {
  const store = createInMemoryAuthRateLimitStore();

  return {
    global: createAuthGlobalRequestRateLimit(store),
    login: createLoginRateLimit(store),
    otpIssue: createOtpIssueRateLimit(store),
    otpVerify: createOtpVerifyRateLimit(store),
  };
}

function consumeOperationRequest(
  harness: ReturnType<typeof createHarness>,
  input: {
    operation: Operation;
    index: number;
    ip: string;
    now: number;
  },
) {
  const globalResult = harness.global.tryConsume({
    ip: input.ip,
    now: input.now,
  });

  if (!globalResult.allowed) {
    return {
      globalResult,
      localResult: null,
    };
  }

  const canonicalEmail = `${input.operation}-${input.index}@example.com`;

  switch (input.operation) {
    case "login": {
      const localResult = harness.login.tryStartAttempt({
        canonicalEmail,
        ip: input.ip,
        now: input.now,
      });

      return { globalResult, localResult };
    }

    case "otp_issue": {
      const localResult = harness.otpIssue.tryStartIssue({
        purpose: "signup",
        canonicalEmail,
        ip: input.ip,
        now: input.now,
      });

      if (localResult.allowed) {
        harness.otpIssue.releaseIssue({
          purpose: "signup",
          canonicalEmail,
          now: input.now,
        });
      }

      return { globalResult, localResult };
    }

    case "otp_verify": {
      const localResult = harness.otpVerify.tryStartAttempt({
        purpose: "signup",
        canonicalEmail,
        ip: input.ip,
        now: input.now,
      });

      return { globalResult, localResult };
    }
  }
}

describe("Auth Global cross-operation regression", () => {
  it("mixed-operation 30회까지 허용하고 31번째를 global ip_short로 차단한다", () => {
    const harness = createHarness();

    const operations: Operation[] = [
      ...Array.from({ length: 12 }, () => "login" as const),
      ...Array.from({ length: 8 }, () => "otp_issue" as const),
      ...Array.from({ length: 10 }, () => "otp_verify" as const),
    ];

    for (const [index, operation] of operations.entries()) {
      const result = consumeOperationRequest(harness, {
        operation,
        index,
        ip: TEST_IP,
        now: BASE_TIME,
      });

      expect(result.globalResult).toEqual({ allowed: true });
      expect(result.localResult).toEqual({ allowed: true });
    }

    const blocked = consumeOperationRequest(harness, {
      operation: "login",
      index: operations.length,
      ip: TEST_IP,
      now: BASE_TIME,
    });

    expect(blocked).toEqual({
      globalResult: {
        allowed: false,
        blockedBy: "ip_short",
      },
      localResult: null,
    });

    // 31번째 global block은 Login limiter를 소비하지 않는다.
    // mixed traffic에서 Login은 12회만 소비했으므로 8회가 더 허용되어
    // 총 20회를 채운 뒤 다음 attempt가 Login ip_short로 차단되어야 한다.
    for (let index = 0; index < 8; index += 1) {
      expect(
        harness.login.tryStartAttempt({
          canonicalEmail: `after-global-block-${index}@example.com`,
          ip: TEST_IP,
          now: BASE_TIME,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      harness.login.tryStartAttempt({
        canonicalEmail: "after-global-block-limit@example.com",
        ip: TEST_IP,
        now: BASE_TIME,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });

    // Global state는 IP별로 독립적이다.
    expect(
      harness.global.tryConsume({
        ip: OTHER_IP,
        now: BASE_TIME,
      }),
    ).toEqual({ allowed: true });
  });

  it("short blocker를 피한 mixed-operation 150회 후 151번째를 global ip_long으로 차단한다", () => {
    const harness = createHarness();
    const operations: Operation[] = [];

    // 25개 cycle을 6초 간격으로 분산한다.
    // 기본 cycle은 Login 4 + OTP Issue 1 + OTP Verify 1이며,
    // 마지막 cycle의 Login 1개를 OTP Verify로 바꿔
    // 최종 합계를 Login 99 + OTP Issue 25 + OTP Verify 26 = 150으로 만든다.
    //
    // 이 분산은 각 operation short window가 먼저 차단되는 것을 피하면서
    // Login local long state를 99회까지 채운다.
    for (let cycleIndex = 0; cycleIndex < 25; cycleIndex += 1) {
      operations.push(
        "login",
        "login",
        "otp_issue",
        "login",
        "otp_verify",
        cycleIndex === 24 ? "otp_verify" : "login",
      );
    }

    const intervalMs = 6 * 1000;

    for (const [index, operation] of operations.entries()) {
      const now = BASE_TIME + index * intervalMs;

      const result = consumeOperationRequest(harness, {
        operation,
        index,
        ip: TEST_IP,
        now,
      });

      expect(result.globalResult).toEqual({ allowed: true });
      expect(result.localResult).toEqual({ allowed: true });
    }

    const boundaryNow = BASE_TIME + operations.length * intervalMs;

    const blocked = consumeOperationRequest(harness, {
      operation: "login",
      index: operations.length,
      ip: TEST_IP,
      now: boundaryNow,
    });

    expect(blocked).toEqual({
      globalResult: {
        allowed: false,
        blockedBy: "ip_long",
      },
      localResult: null,
    });

    // 151번째 global block이 Login local state를 소비하지 않았다면
    // 다음 직접 Login attempt가 정확히 100번째로 허용되고,
    // 그 다음 101번째가 Login ip_long으로 차단되어야 한다.
    expect(
      harness.login.tryStartAttempt({
        canonicalEmail: "after-global-long-block-100@example.com",
        ip: TEST_IP,
        now: boundaryNow,
      }),
    ).toEqual({ allowed: true });

    expect(
      harness.login.tryStartAttempt({
        canonicalEmail: "after-global-long-block-101@example.com",
        ip: TEST_IP,
        now: boundaryNow,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_long",
    });
  });
});
