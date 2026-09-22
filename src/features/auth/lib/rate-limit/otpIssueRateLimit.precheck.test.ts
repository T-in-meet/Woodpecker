import { describe, expect, it } from "vitest";

import {
  OTP_ISSUE_COOLDOWN_MS,
  OTP_ISSUE_IP_SHORT_LIMIT,
} from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import { createInMemoryAuthRateLimitStore } from "@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore";

import { createOtpIssueRateLimit } from "./otpIssueRateLimit";

const BASE_NOW = 1_000_000;
const EMAIL = "user@example.com";
const IP = "203.0.113.10";

describe("otpIssueRateLimit read-only precheck", () => {
  it("full precheck는 allowed여도 cooldown/IP/in-flight를 소비하지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);
    const input = {
      purpose: "signup" as const,
      canonicalEmail: EMAIL,
      ip: IP,
      now: BASE_NOW,
    };

    expect(rateLimit.precheckIssue(input)).toEqual({ allowed: true });
    expect(rateLimit.precheckIssue(input)).toEqual({ allowed: true });
    expect(rateLimit.tryStartIssue(input)).toEqual({ allowed: true });
  });

  it("full precheck는 현재 email-specific 상태를 같은 blocker 우선순위로 판정한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({ allowed: true });

    expect(
      rateLimit.precheckIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + 1,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "cooldown",
    });
  });

  it("IP-only precheck는 email cooldown/in-flight를 보지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({ allowed: true });

    expect(
      rateLimit.precheckIpIssue({
        ip: IP,
        now: BASE_NOW + 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("IP-only precheck 반복 호출은 IP quota를 소비하지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    for (let index = 0; index < OTP_ISSUE_IP_SHORT_LIMIT + 2; index += 1) {
      expect(
        rateLimit.precheckIpIssue({
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({ allowed: true });
  });

  it("precheck allowed 후 상태가 바뀌면 final tryStartIssue가 다시 차단할 수 있다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    expect(
      rateLimit.precheckIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({ allowed: true });

    for (let index = 0; index < OTP_ISSUE_IP_SHORT_LIMIT; index += 1) {
      const canonicalEmail = `other-${index}@example.com`;

      expect(
        rateLimit.tryStartIssue({
          purpose: "signup",
          canonicalEmail,
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });

      rateLimit.releaseIssue({
        purpose: "signup",
        canonicalEmail,
        now: BASE_NOW,
      });
    }

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });
  });

  it("precheck와 final check는 같은 IP blocker를 반환한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    for (let index = 0; index < OTP_ISSUE_IP_SHORT_LIMIT; index += 1) {
      const canonicalEmail = `quota-${index}@example.com`;

      expect(
        rateLimit.tryStartIssue({
          purpose: "signup",
          canonicalEmail,
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });

      rateLimit.releaseIssue({
        purpose: "signup",
        canonicalEmail,
        now: BASE_NOW,
      });
    }

    const target = {
      purpose: "signup" as const,
      canonicalEmail: "blocked@example.com",
      ip: IP,
      now: BASE_NOW + OTP_ISSUE_COOLDOWN_MS,
    };

    expect(rateLimit.precheckIssue(target)).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });
    expect(rateLimit.tryStartIssue(target)).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });
  });
});
