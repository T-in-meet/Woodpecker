import { describe, expect, it } from "vitest";

import {
  OTP_ISSUE_COOLDOWN_MS,
  OTP_ISSUE_EMAIL_SUCCESS_LIMIT,
  OTP_ISSUE_EMAIL_SUCCESS_WINDOW_MS,
  OTP_ISSUE_IP_LONG_LIMIT,
  OTP_ISSUE_IP_LONG_WINDOW_MS,
  OTP_ISSUE_IP_SHORT_LIMIT,
} from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import { createInMemoryAuthRateLimitStore } from "@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore";

import { createOtpIssueRateLimit } from "./otpIssueRateLimit";

const BASE_NOW = 1_000_000;
const EMAIL = "user@example.com";
const IP = "203.0.113.10";

describe("otpIssueRateLimit", () => {
  it("Provider 시작 시 cooldown을 소비하고 정확히 15초 후 다시 허용한다", () => {
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

    rateLimit.releaseIssue({
      purpose: "signup",
      canonicalEmail: EMAIL,
      now: BASE_NOW,
    });

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + OTP_ISSUE_COOLDOWN_MS - 1,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "cooldown",
    });

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + OTP_ISSUE_COOLDOWN_MS,
      }),
    ).toEqual({ allowed: true });
  });

  it("성공으로 기록한 Issue만 Email successful quota를 소비한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    for (
      let index = 0;
      index <= OTP_ISSUE_EMAIL_SUCCESS_LIMIT;
      index += 1
    ) {
      const now =
        BASE_NOW + index * (OTP_ISSUE_COOLDOWN_MS + 1);

      expect(
        rateLimit.tryStartIssue({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip: IP,
          now,
        }),
      ).toEqual({ allowed: true });

      // Provider/Email 실패를 가정해 success 기록 없이 release한다.
      rateLimit.releaseIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        now,
      });
    }
  });

  it("successful Email quota는 purpose별로 독립이고 rolling window 후 복구한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    for (
      let index = 0;
      index < OTP_ISSUE_EMAIL_SUCCESS_LIMIT;
      index += 1
    ) {
      const now =
        BASE_NOW + index * (OTP_ISSUE_COOLDOWN_MS + 1);

      expect(
        rateLimit.tryStartIssue({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip: IP,
          now,
        }),
      ).toEqual({ allowed: true });

      rateLimit.recordSuccessfulIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        now,
      });

      rateLimit.releaseIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        now,
      });
    }

    const blockedAt =
      BASE_NOW +
      OTP_ISSUE_EMAIL_SUCCESS_LIMIT * (OTP_ISSUE_COOLDOWN_MS + 1);

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: blockedAt,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_success",
    });

    // 같은 Email이어도 Recovery purpose의 successful quota는 독립적이다.
    expect(
      rateLimit.tryStartIssue({
        purpose: "reset-password",
        canonicalEmail: EMAIL,
        ip: IP,
        now: blockedAt,
      }),
    ).toEqual({ allowed: true });

    rateLimit.releaseIssue({
      purpose: "reset-password",
      canonicalEmail: EMAIL,
      now: blockedAt,
    });

    // 가장 오래된 성공 timestamp가 15분 window 밖으로 나가면 다시 허용된다.
    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + OTP_ISSUE_EMAIL_SUCCESS_WINDOW_MS + 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("동일 purpose/email의 in-flight를 차단하고 release 후 다시 허용한다", () => {
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

    const afterCooldown = BASE_NOW + OTP_ISSUE_COOLDOWN_MS;

    // cooldown이 끝나도 첫 Issue가 아직 실행 중이면 in-flight가 막는다.
    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: afterCooldown,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "in_flight",
    });

    rateLimit.releaseIssue({
      purpose: "signup",
      canonicalEmail: EMAIL,
      now: afterCooldown,
    });

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: afterCooldown,
      }),
    ).toEqual({ allowed: true });
  });

  it("동일 Email이어도 다른 purpose의 cooldown과 in-flight는 독립적이다", () => {
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
      rateLimit.tryStartIssue({
        purpose: "reset-password",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({ allowed: true });
  });

  it("in-flight 차단은 IP attempt를 부분 소비하지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    // 첫 요청은 IP quota 1회를 소비하고 in-flight 상태를 유지한다.
    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({ allowed: true });

    const afterCooldown = BASE_NOW + OTP_ISSUE_COOLDOWN_MS;

    // IP short quota를 총 9회까지 채운다.
    for (
      let index = 1;
      index < OTP_ISSUE_IP_SHORT_LIMIT - 1;
      index += 1
    ) {
      const canonicalEmail = `other-${index}@example.com`;

      expect(
        rateLimit.tryStartIssue({
          purpose: "signup",
          canonicalEmail,
          ip: IP,
          now: afterCooldown,
        }),
      ).toEqual({ allowed: true });

      rateLimit.releaseIssue({
        purpose: "signup",
        canonicalEmail,
        now: afterCooldown,
      });
    }

    // IP quota에는 여유가 있지만 동일 Email의 in-flight 때문에 차단된다.
    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: afterCooldown,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "in_flight",
    });

    rateLimit.releaseIssue({
      purpose: "signup",
      canonicalEmail: EMAIL,
      now: afterCooldown,
    });

    // 차단된 요청이 IP quota를 소비하지 않았다면 마지막 1회가 허용된다.
    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: "last@example.com",
        ip: IP,
        now: afterCooldown,
      }),
    ).toEqual({ allowed: true });
  });

  it("OTP Issue IP short quota는 signup/reset-password가 공유한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    for (
      let index = 0;
      index < OTP_ISSUE_IP_SHORT_LIMIT;
      index += 1
    ) {
      const purpose =
        index % 2 === 0 ? "signup" : "reset-password";
      const canonicalEmail = `user-${index}@example.com`;

      expect(
        rateLimit.tryStartIssue({
          purpose,
          canonicalEmail,
          ip: IP,
          now: BASE_NOW,
        }),
      ).toEqual({ allowed: true });

      rateLimit.releaseIssue({
        purpose,
        canonicalEmail,
        now: BASE_NOW,
      });
    }

    const blockedEmail = "blocked@example.com";

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: blockedEmail,
        ip: IP,
        now: BASE_NOW,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_short",
    });

    // IP 차단에서 Email cooldown/in-flight가 부분 소비되지 않았음을 검증한다.
    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: blockedEmail,
        ip: "203.0.113.20",
        now: BASE_NOW,
      }),
    ).toEqual({ allowed: true });
  });

  it("OTP Issue IP long quota는 rolling 15분 window를 사용한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    const interval =
      OTP_ISSUE_IP_LONG_WINDOW_MS / OTP_ISSUE_IP_LONG_LIMIT;

    for (let index = 0; index < OTP_ISSUE_IP_LONG_LIMIT; index += 1) {
      const now = BASE_NOW + index * interval;
      const purpose =
        index % 2 === 0 ? "signup" : "reset-password";
      const canonicalEmail = `long-${index}@example.com`;

      expect(
        rateLimit.tryStartIssue({
          purpose,
          canonicalEmail,
          ip: IP,
          now,
        }),
      ).toEqual({ allowed: true });

      rateLimit.releaseIssue({
        purpose,
        canonicalEmail,
        now,
      });
    }

    // 정확히 15분 경계의 timestamp는 현재 sliding-window 규칙상 아직 유효하다.
    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: "long-blocked@example.com",
        ip: IP,
        now: BASE_NOW + OTP_ISSUE_IP_LONG_WINDOW_MS,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "ip_long",
    });

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: "long-blocked@example.com",
        ip: IP,
        now: BASE_NOW + OTP_ISSUE_IP_LONG_WINDOW_MS + 1,
      }),
    ).toEqual({ allowed: true });
  });
});
