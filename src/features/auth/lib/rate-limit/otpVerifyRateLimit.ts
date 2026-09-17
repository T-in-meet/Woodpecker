import type { OtpPurpose } from "@/features/auth/constants/otp";
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
import type {
  FailureStreakState,
  FixedWindowState,
  TimestampWindowState,
} from "@/features/auth/lib/rate-limit/authRateLimitTypes";
import { inMemoryAuthRateLimitStore } from "@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore";
import { evaluateSlidingWindow } from "@/features/auth/utils/rateLimit.utils";

/**
 * OTP Verify shared IP attempt key prefix.
 *
 * Signup과 Recovery가 동일 IP quota를 공유한다.
 */
const OTP_VERIFY_IP_ATTEMPT_KEY_PREFIX = "auth:otp-verify:ip:attempt:";

/**
 * OTP Verify shared Email failure streak key prefix.
 *
 * Signup과 Recovery가 동일 canonicalEmail streak를 공유한다.
 */
const OTP_VERIFY_FAILURE_STREAK_KEY_PREFIX =
  "auth:otp-verify:email:failure-streak:";

/**
 * OTP Verify 시작 차단 원인.
 *
 * 외부 응답 contract가 아니라 Verify operation 내부 판정 및
 * structured logging 용도다.
 */
export type OtpVerifyRateLimitBlockedBy =
  | "email_total"
  | "ip_short"
  | "ip_long"
  | "failure_streak";

/**
 * OTP Verify 시작 판정 결과.
 */
export type OtpVerifyRateLimitStartResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      blockedBy: OtpVerifyRateLimitBlockedBy;
    };

/**
 * Provider 결과를 caller/classifier가 분류해서 전달하는 값.
 *
 * Rate Limit service는 Supabase error 객체 자체를 해석하지 않는다.
 * provider/system/unknown/transport/timeout 계열은 caller가
 * `provider_error`로 분류해서 전달한다.
 */
export type OtpVerifyRateLimitOutcome =
  | "success"
  | "otp_failure"
  | "provider_rate_limited"
  | "provider_error";

/**
 * OTP Verify 시작 입력.
 */
type TryStartOtpVerifyInput = {
  purpose: OtpPurpose;
  canonicalEmail: string;
  ip: string;
  now?: number;
};

/**
 * OTP Verify 결과 기록 입력.
 */
type RecordOtpVerifyResultInput = {
  canonicalEmail: string;
  outcome: OtpVerifyRateLimitOutcome;
  now?: number;
};

/**
 * OTP Verify 시작 조건 평가 결과.
 *
 * Store를 변경하지 않는 순수 평가 결과와, 모든 blocker가 통과한 경우
 * atomic section에서 저장해야 할 Email/IP 다음 상태를 함께 전달한다.
 */
type OtpVerifyEvaluation = {
  result: OtpVerifyRateLimitStartResult;
  nextEmailState: FixedWindowState | undefined;
  prunedIpLongWindow: TimestampWindowState;
};

/**
 * purpose별 OTP Verify Email total attempt key를 생성한다.
 *
 * @param purpose OTP Verify 목적
 * @param canonicalEmail 정규화된 이메일
 * @returns purpose별 Email attempt Store key
 */
function getOtpVerifyEmailAttemptKey(
  purpose: OtpPurpose,
  canonicalEmail: string,
): string {
  return `auth:otp-verify:${purpose}:email:attempt:${canonicalEmail}`;
}

/**
 * shared OTP Verify IP attempt key를 생성한다.
 *
 * @param ip 신뢰 가능한 사용자 IP
 * @returns shared IP attempt Store key
 */
function getOtpVerifyIpAttemptKey(ip: string): string {
  return `${OTP_VERIFY_IP_ATTEMPT_KEY_PREFIX}${ip}`;
}

/**
 * shared OTP Verify Email failure streak key를 생성한다.
 *
 * @param canonicalEmail 정규화된 이메일
 * @returns shared failure streak Store key
 */
function getOtpVerifyFailureStreakKey(canonicalEmail: string): string {
  return `${OTP_VERIFY_FAILURE_STREAK_KEY_PREFIX}${canonicalEmail}`;
}

/**
 * purpose별 Email fixed-window 상태를 평가한다.
 *
 * 이 함수는 Store를 변경하지 않고, 허용되는 경우에 저장해야 할
 * 다음 fixed-window 상태만 계산한다.
 *
 * @param current 현재 Email fixed-window 상태
 * @param now 평가 시각
 * @returns 허용 여부와 허용 시 다음 fixed-window 상태
 */
function evaluateEmailAttemptState(
  current: FixedWindowState | undefined,
  now: number,
):
  | {
      allowed: true;
      nextState: FixedWindowState;
    }
  | {
      allowed: false;
    } {
  if (
    current === undefined ||
    now - current.windowStartedAt >= OTP_VERIFY_EMAIL_ATTEMPT_WINDOW_MS
  ) {
    return {
      allowed: true,
      nextState: {
        count: 1,
        windowStartedAt: now,
      },
    };
  }

  if (current.count >= OTP_VERIFY_EMAIL_ATTEMPT_LIMIT) {
    return {
      allowed: false,
    };
  }

  return {
    allowed: true,
    nextState: {
      count: current.count + 1,
      windowStartedAt: current.windowStartedAt,
    },
  };
}

/**
 * shared Email failure streak가 현재 차단 상태인지 판단한다.
 *
 * inactivity 10분이 지난 streak는 만료된 것으로만 취급하며
 * 여기서는 Store를 변경하지 않는다.
 *
 * @param current 현재 shared failure streak 상태
 * @param now 평가 시각
 * @returns 현재 failure streak 차단 여부
 */
function isFailureStreakBlocked(
  current: FailureStreakState | undefined,
  now: number,
): boolean {
  if (current === undefined) {
    return false;
  }

  const active =
    now - current.lastFailureAt < OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS;

  return active && current.count >= OTP_VERIFY_FAILURE_STREAK_LIMIT;
}

/**
 * OTP Verify 전체 시작 조건을 순수하게 평가한다.
 *
 * blocker 우선순위는 Email total → IP short → IP long → failure streak다.
 * 모든 조건을 통과한 경우에만 atomic consume에 필요한 다음 상태를 반환한다.
 *
 * @param input 현재 Email/IP/failure streak 상태와 평가 시각
 * @returns OTP Verify 시작 평가 결과
 */
function evaluateOtpVerifyState(input: {
  emailState: FixedWindowState | undefined;
  ipState: TimestampWindowState;
  failureStreak: FailureStreakState | undefined;
  now: number;
}): OtpVerifyEvaluation {
  const emailEvaluation = evaluateEmailAttemptState(
    input.emailState,
    input.now,
  );

  if (!emailEvaluation.allowed) {
    return {
      result: {
        allowed: false,
        blockedBy: "email_total",
      },
      nextEmailState: undefined,
      prunedIpLongWindow: input.ipState,
    };
  }

  const ipShortEvaluation = evaluateSlidingWindow(
    input.ipState,
    OTP_VERIFY_IP_SHORT_LIMIT,
    OTP_VERIFY_IP_SHORT_WINDOW_MS,
    input.now,
    { appendOnAllow: false },
  );

  if (!ipShortEvaluation.allowed) {
    return {
      result: {
        allowed: false,
        blockedBy: "ip_short",
      },
      nextEmailState: undefined,
      prunedIpLongWindow: input.ipState,
    };
  }

  const ipLongEvaluation = evaluateSlidingWindow(
    input.ipState,
    OTP_VERIFY_IP_LONG_LIMIT,
    OTP_VERIFY_IP_LONG_WINDOW_MS,
    input.now,
    { appendOnAllow: false },
  );

  if (!ipLongEvaluation.allowed) {
    return {
      result: {
        allowed: false,
        blockedBy: "ip_long",
      },
      nextEmailState: undefined,
      prunedIpLongWindow: ipLongEvaluation.pruned,
    };
  }

  if (isFailureStreakBlocked(input.failureStreak, input.now)) {
    return {
      result: {
        allowed: false,
        blockedBy: "failure_streak",
      },
      nextEmailState: undefined,
      prunedIpLongWindow: ipLongEvaluation.pruned,
    };
  }

  return {
    result: {
      allowed: true,
    },
    nextEmailState: emailEvaluation.nextState,
    prunedIpLongWindow: ipLongEvaluation.pruned,
  };
}

/**
 * OTP Verify Rate Limit service를 생성한다.
 *
 * Email total quota는 purpose별로 분리하고,
 * IP attempt와 failure streak는 Signup/Recovery가 공유한다.
 * Store를 주입받아 operation 정책과 저장 구현을 분리한다.
 *
 * @param store Auth Rate Limit Store
 * @returns OTP Verify Rate Limit service
 */
export function createOtpVerifyRateLimit(store: AuthRateLimitStore) {
  return {
    /**
     * 실제 OTP Verify Provider operation을 시작할 수 있는지 확인한다.
     *
     * 모든 blocker를 먼저 평가하고, 전부 통과한 경우에만 같은
     * synchronous atomic section에서 Email/IP attempt를 함께 소비한다.
     *
     * @param input OTP Verify identity와 평가 시각
     * @returns Provider operation 시작 허용 여부
     */
    tryStartAttempt(
      input: TryStartOtpVerifyInput,
    ): OtpVerifyRateLimitStartResult {
      const now = input.now ?? Date.now();

      const emailKey = getOtpVerifyEmailAttemptKey(
        input.purpose,
        input.canonicalEmail,
      );
      const ipKey = getOtpVerifyIpAttemptKey(input.ip);
      const failureStreakKey = getOtpVerifyFailureStreakKey(
        input.canonicalEmail,
      );

      return store.runAtomic(() => {
        const evaluation = evaluateOtpVerifyState({
          emailState: store.getFixedWindow(emailKey),
          ipState: store.getTimestampWindow(ipKey) ?? [],
          failureStreak: store.getFailureStreak(failureStreakKey),
          now,
        });

        if (!evaluation.result.allowed) {
          return evaluation.result;
        }

        if (evaluation.nextEmailState === undefined) {
          throw new Error(
            "OTP Verify Email attempt state is missing after allowed evaluation.",
          );
        }

        // 모든 blocker를 통과한 뒤에만 Email/IP attempt를 함께 소비한다.
        store.setFixedWindow(emailKey, evaluation.nextEmailState);

        // IP short/long은 동일 timestamp collection을 공유한다.
        store.setTimestampWindow(ipKey, [
          ...evaluation.prunedIpLongWindow,
          now,
        ]);

        return {
          allowed: true,
        };
      }, now);
    },

    /**
     * 실제 OTP Verify Provider 결과를 shared failure streak에 반영한다.
     *
     * 성공과 명확한 countable OTP failure만 streak를 변경한다.
     * Provider 429/system/unknown/transport/timeout 계열 결과는
     * caller가 Provider 계열 outcome으로 분류하며 streak를 변경하지 않는다.
     *
     * @param input canonicalEmail, 분류된 Verify outcome, 평가 시각
     */
    recordResult(input: RecordOtpVerifyResultInput): void {
      const outcome = input.outcome;

      switch (outcome) {
        case "provider_rate_limited":
        case "provider_error":
          return;

        case "success": {
          const now = input.now ?? Date.now();
          const failureStreakKey = getOtpVerifyFailureStreakKey(
            input.canonicalEmail,
          );

          store.runAtomic(() => {
            // 성공은 shared failure streak만 clear한다.
            store.deleteFailureStreak(failureStreakKey);
          }, now);
          return;
        }

        case "otp_failure": {
          const now = input.now ?? Date.now();
          const failureStreakKey = getOtpVerifyFailureStreakKey(
            input.canonicalEmail,
          );

          store.runAtomic(() => {
            const current = store.getFailureStreak(failureStreakKey);

            const currentIsActive =
              current !== undefined &&
              now - current.lastFailureAt <
                OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS;

            // inactivity가 끝난 streak는 이어받지 않고 새 streak를 시작한다.
            if (!currentIsActive) {
              store.setFailureStreak(failureStreakKey, {
                count: 1,
                lastFailureAt: now,
              });
              return;
            }

            // 명확한 OTP validity failure만 active streak에 누적한다.
            store.setFailureStreak(failureStreakKey, {
              count: current.count + 1,
              lastFailureAt: now,
            });
          }, now);
          return;
        }

        default: {
          // outcome union이 확장되면 새 값을 명시적으로 분류하도록 강제한다.
          const exhaustiveCheck: never = outcome;
          return exhaustiveCheck;
        }
      }
    },
  };
}

/**
 * 현재 process에서 사용하는 OTP Verify Rate Limit singleton.
 */
export const otpVerifyRateLimit = createOtpVerifyRateLimit(
  inMemoryAuthRateLimitStore,
);
