import { describe, expect, it } from "vitest";

import type { OtpPurpose } from "@/features/auth/constants/otp";
import {
  OTP_ISSUE_COOLDOWN_MS,
  OTP_ISSUE_EMAIL_ATTEMPT_LIMIT,
  OTP_ISSUE_EMAIL_ATTEMPT_WINDOW_MS,
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

type ConsumeAttemptsInput = {
  count: number;
  purpose?: OtpPurpose;
  canonicalEmail?: string;
  ip?: string;
  baseNow?: number;
};

function consumeAttempts({
  count,
  purpose = "signup",
  canonicalEmail = EMAIL,
  ip = IP,
  baseNow = BASE_NOW,
}: ConsumeAttemptsInput) {
  const store = createInMemoryAuthRateLimitStore();
  const rateLimit = createOtpIssueRateLimit(store);

  for (let index = 0; index < count; index += 1) {
    const now = baseNow + index * OTP_ISSUE_COOLDOWN_MS;

    expect(
      rateLimit.tryStartIssue({
        purpose,
        canonicalEmail,
        ip,
        now,
      }),
    ).toEqual({ allowed: true });

    rateLimit.releaseIssue({
      purpose,
      canonicalEmail,
      now,
    });
  }

  return {
    rateLimit,
    baseNow,
    purpose,
    canonicalEmail,
    ip,
  };
}

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

    for (let index = 0; index <= OTP_ISSUE_EMAIL_SUCCESS_LIMIT; index += 1) {
      const now = BASE_NOW + index * (OTP_ISSUE_COOLDOWN_MS + 1);

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

    for (let index = 0; index < OTP_ISSUE_EMAIL_SUCCESS_LIMIT; index += 1) {
      const now = BASE_NOW + index * (OTP_ISSUE_COOLDOWN_MS + 1);

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
      BASE_NOW + OTP_ISSUE_EMAIL_SUCCESS_LIMIT * (OTP_ISSUE_COOLDOWN_MS + 1);

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
    for (let index = 1; index < OTP_ISSUE_IP_SHORT_LIMIT - 1; index += 1) {
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

    for (let index = 0; index < OTP_ISSUE_IP_SHORT_LIMIT; index += 1) {
      const purpose = index % 2 === 0 ? "signup" : "reset-password";
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

    const interval = OTP_ISSUE_IP_LONG_WINDOW_MS / OTP_ISSUE_IP_LONG_LIMIT;

    for (let index = 0; index < OTP_ISSUE_IP_LONG_LIMIT; index += 1) {
      const now = BASE_NOW + index * interval;
      const purpose = index % 2 === 0 ? "signup" : "reset-password";
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

  it("failure-only Provider-start를 10회 허용하고 11번째를 email_attempt로 차단한다", () => {
    const { rateLimit, baseNow, purpose, canonicalEmail, ip } = consumeAttempts(
      {
        count: OTP_ISSUE_EMAIL_ATTEMPT_LIMIT,
      },
    );

    const now = baseNow + OTP_ISSUE_EMAIL_ATTEMPT_LIMIT * OTP_ISSUE_COOLDOWN_MS;

    expect(
      rateLimit.tryStartIssue({
        purpose,
        canonicalEmail,
        ip,
        now,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_attempt",
    });
  });

  it("정확히 15분에는 oldest attempt가 유효하고 +1ms에서 만료된다", () => {
    const { rateLimit, baseNow, purpose, canonicalEmail, ip } = consumeAttempts(
      {
        count: OTP_ISSUE_EMAIL_ATTEMPT_LIMIT,
      },
    );

    expect(
      rateLimit.tryStartIssue({
        purpose,
        canonicalEmail,
        ip,
        now: baseNow + OTP_ISSUE_EMAIL_ATTEMPT_WINDOW_MS,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_attempt",
    });

    expect(
      rateLimit.tryStartIssue({
        purpose,
        canonicalEmail,
        ip,
        now: baseNow + OTP_ISSUE_EMAIL_ATTEMPT_WINDOW_MS + 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("attempt quota는 purpose별로 분리한다", () => {
    const { rateLimit, baseNow, canonicalEmail, ip } = consumeAttempts({
      count: OTP_ISSUE_EMAIL_ATTEMPT_LIMIT,
      purpose: "signup",
    });

    const now = baseNow + OTP_ISSUE_EMAIL_ATTEMPT_LIMIT * OTP_ISSUE_COOLDOWN_MS;

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail,
        ip,
        now,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_attempt",
    });

    expect(
      rateLimit.tryStartIssue({
        purpose: "reset-password",
        canonicalEmail,
        ip,
        now,
      }),
    ).toEqual({ allowed: true });
  });

  it("precheckIssue는 attempt quota를 읽기만 하고 precheckIpIssue는 IP-only를 유지한다", () => {
    const { rateLimit, baseNow, purpose, canonicalEmail, ip } = consumeAttempts(
      {
        count: OTP_ISSUE_EMAIL_ATTEMPT_LIMIT,
      },
    );

    const now = baseNow + OTP_ISSUE_EMAIL_ATTEMPT_LIMIT * OTP_ISSUE_COOLDOWN_MS;

    expect(
      rateLimit.precheckIssue({
        purpose,
        canonicalEmail,
        ip,
        now,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_attempt",
    });

    expect(rateLimit.precheckIpIssue({ ip, now })).toEqual({ allowed: true });

    // read-only precheck가 attempt를 추가로 소비하지 않았으므로
    // 원래 window가 만료되는 즉시 다시 시작할 수 있다.
    expect(
      rateLimit.tryStartIssue({
        purpose,
        canonicalEmail,
        ip,
        now: baseNow + OTP_ISSUE_EMAIL_ATTEMPT_WINDOW_MS + 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("releaseIssue는 in-flight만 해제하고 attempt를 rollback하지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    for (let index = 0; index < OTP_ISSUE_EMAIL_ATTEMPT_LIMIT; index += 1) {
      const now = BASE_NOW + index * OTP_ISSUE_COOLDOWN_MS;

      expect(
        rateLimit.tryStartIssue({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip: IP,
          now,
        }),
      ).toEqual({ allowed: true });

      rateLimit.releaseIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        now,
      });
    }

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + OTP_ISSUE_EMAIL_ATTEMPT_LIMIT * OTP_ISSUE_COOLDOWN_MS,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_attempt",
    });
  });

  it("기존 blocker로 차단된 요청은 Email attempt를 부분 소비하지 않는다", () => {
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

    // 첫 Issue를 release하지 않아 in-flight를 유지한다.
    // cooldown이 끝난 시점의 차단 요청은 attempt를 소비하면 안 된다.
    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: IP,
        now: BASE_NOW + OTP_ISSUE_COOLDOWN_MS,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "in_flight",
    });

    rateLimit.releaseIssue({
      purpose: "signup",
      canonicalEmail: EMAIL,
      now: BASE_NOW + OTP_ISSUE_COOLDOWN_MS,
    });

    // 첫 allowed start 외에는 attempt가 소비되지 않았으므로 남은 9회가 모두 허용된다.
    for (let index = 1; index < OTP_ISSUE_EMAIL_ATTEMPT_LIMIT; index += 1) {
      const now = BASE_NOW + (index + 1) * OTP_ISSUE_COOLDOWN_MS;

      expect(
        rateLimit.tryStartIssue({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip: IP,
          now,
        }),
      ).toEqual({ allowed: true });

      rateLimit.releaseIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        now,
      });
    }
  });

  it("email_attempt 차단은 shared IP attempt를 부분 소비하지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);
    const targetEmail = "target@example.com";

    // target Email attempt quota를 서로 다른 IP로 소진하여 shared IP quota와 분리한다.
    for (let index = 0; index < OTP_ISSUE_EMAIL_ATTEMPT_LIMIT; index += 1) {
      const now = BASE_NOW + index * OTP_ISSUE_COOLDOWN_MS;
      const ip = `203.0.113.${index + 1}`;

      expect(
        rateLimit.tryStartIssue({
          purpose: "signup",
          canonicalEmail: targetEmail,
          ip,
          now,
        }),
      ).toEqual({ allowed: true });

      rateLimit.releaseIssue({
        purpose: "signup",
        canonicalEmail: targetEmail,
        now,
      });
    }

    const sharedIp = "198.51.100.50";
    const blockedAt =
      BASE_NOW + OTP_ISSUE_EMAIL_ATTEMPT_LIMIT * OTP_ISSUE_COOLDOWN_MS;

    // 같은 shared IP를 다른 Email들로 short quota 직전까지 채운다.
    for (let index = 0; index < 9; index += 1) {
      const email = `ip-fill-${index}@example.com`;

      expect(
        rateLimit.tryStartIssue({
          purpose: "signup",
          canonicalEmail: email,
          ip: sharedIp,
          now: blockedAt,
        }),
      ).toEqual({ allowed: true });

      rateLimit.releaseIssue({
        purpose: "signup",
        canonicalEmail: email,
        now: blockedAt,
      });
    }

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: targetEmail,
        ip: sharedIp,
        now: blockedAt,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_attempt",
    });

    // email_attempt 차단이 IP를 소비하지 않았다면 마지막 10번째 IP attempt가 허용된다.
    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: "last-ip-slot@example.com",
        ip: sharedIp,
        now: blockedAt,
      }),
    ).toEqual({ allowed: true });
  });

  it("email_success와 email_attempt가 동시에 소진되면 email_success가 우선한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    for (let index = 0; index < OTP_ISSUE_EMAIL_ATTEMPT_LIMIT; index += 1) {
      const now = BASE_NOW + index * OTP_ISSUE_COOLDOWN_MS;
      const ip = `198.51.100.${index + 1}`;

      expect(
        rateLimit.tryStartIssue({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip,
          now,
        }),
      ).toEqual({ allowed: true });

      rateLimit.releaseIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        now,
      });
    }

    // priority 판정만 고정하기 위해 successful quota state를 별도로 준비한다.
    for (let index = 0; index < OTP_ISSUE_EMAIL_SUCCESS_LIMIT; index += 1) {
      rateLimit.recordSuccessfulIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        now: BASE_NOW + index * OTP_ISSUE_COOLDOWN_MS,
      });
    }

    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: "203.0.113.250",
        now: BASE_NOW + OTP_ISSUE_EMAIL_ATTEMPT_LIMIT * OTP_ISSUE_COOLDOWN_MS,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_success",
    });
  });

  it("email_attempt와 cooldown/in-flight가 동시에 활성화되면 email_attempt가 우선한다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const rateLimit = createOtpIssueRateLimit(store);

    for (let index = 0; index < OTP_ISSUE_EMAIL_ATTEMPT_LIMIT; index += 1) {
      const now = BASE_NOW + index * OTP_ISSUE_COOLDOWN_MS;
      const ip = `192.0.2.${index + 1}`;

      expect(
        rateLimit.tryStartIssue({
          purpose: "signup",
          canonicalEmail: EMAIL,
          ip,
          now,
        }),
      ).toEqual({ allowed: true });

      if (index < OTP_ISSUE_EMAIL_ATTEMPT_LIMIT - 1) {
        rateLimit.releaseIssue({
          purpose: "signup",
          canonicalEmail: EMAIL,
          now,
        });
      }
    }

    const lastStartedAt =
      BASE_NOW + (OTP_ISSUE_EMAIL_ATTEMPT_LIMIT - 1) * OTP_ISSUE_COOLDOWN_MS;

    // 마지막 start의 cooldown과 in-flight가 모두 남아 있지만 attempt가 더 높은 우선순위다.
    expect(
      rateLimit.tryStartIssue({
        purpose: "signup",
        canonicalEmail: EMAIL,
        ip: "192.0.2.250",
        now: lastStartedAt + 1,
      }),
    ).toEqual({
      allowed: false,
      blockedBy: "email_attempt",
    });
  });
});
