import {
  LOGIN_EMAIL_ATTEMPT_LIMIT,
  LOGIN_EMAIL_ATTEMPT_WINDOW_MS,
  LOGIN_FAILURE_STREAK_INACTIVITY_MS,
  LOGIN_FAILURE_STREAK_LIMIT,
  LOGIN_IP_LONG_LIMIT,
  LOGIN_IP_LONG_WINDOW_MS,
  LOGIN_IP_SHORT_LIMIT,
  LOGIN_IP_SHORT_WINDOW_MS,
} from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import type { AuthRateLimitStore } from "@/features/auth/lib/rate-limit/authRateLimitStore";
import { inMemoryAuthRateLimitStore } from "@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore";
import { evaluateSlidingWindow } from "@/features/auth/utils/rateLimit.utils";

/**
 * Password Login Email attempt key prefix.
 */
const LOGIN_EMAIL_ATTEMPT_KEY_PREFIX = "auth:login:email:attempt:";

/**
 * Password Login IP attempt key prefix.
 */
const LOGIN_IP_ATTEMPT_KEY_PREFIX = "auth:login:ip:attempt:";

/**
 * Password Login credential failure streak key prefix.
 */
const LOGIN_FAILURE_STREAK_KEY_PREFIX =
  "auth:login:email:failure-streak:";

/**
 * Password Login 시작 차단 원인.
 *
 * 외부 public error contract가 아니라 operation 내부 판정용 값이다.
 */
export type LoginRateLimitBlockedBy =
  | "email_attempt"
  | "ip_short"
  | "ip_long"
  | "failure_streak";

/**
 * Password Login attempt 시작 판정 결과.
 */
export type LoginRateLimitStartResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      blockedBy: LoginRateLimitBlockedBy;
    };

/**
 * Provider operation 종료 후 Rate Limit streak에 반영할 결과.
 *
 * `non_credential_failure`에는 Provider 429, Provider/System error,
 * transport/timeout 등 명확한 credential rejection이 아닌 결과가 포함된다.
 */
export type LoginAttemptResult =
  | "success"
  | "credential_failure"
  | "non_credential_failure";

/**
 * Password Login attempt 시작 입력.
 */
type TryStartLoginAttemptInput = {
  canonicalEmail: string;
  ip: string;
  now?: number;
};

/**
 * Password Login Provider 결과 기록 입력.
 */
type RecordLoginResultInput = {
  canonicalEmail: string;
  result: LoginAttemptResult;
  now?: number;
};

/**
 * Password Login Email attempt key를 생성한다.
 *
 * @param canonicalEmail 정규화된 이메일
 * @returns Email attempt Store key
 */
function getLoginEmailAttemptKey(canonicalEmail: string): string {
  return `${LOGIN_EMAIL_ATTEMPT_KEY_PREFIX}${canonicalEmail}`;
}

/**
 * Password Login IP attempt key를 생성한다.
 *
 * @param ip 신뢰 가능한 사용자 IP
 * @returns IP attempt Store key
 */
function getLoginIpAttemptKey(ip: string): string {
  return `${LOGIN_IP_ATTEMPT_KEY_PREFIX}${ip}`;
}

/**
 * Password Login credential failure streak key를 생성한다.
 *
 * @param canonicalEmail 정규화된 이메일
 * @returns Failure streak Store key
 */
function getLoginFailureStreakKey(canonicalEmail: string): string {
  return `${LOGIN_FAILURE_STREAK_KEY_PREFIX}${canonicalEmail}`;
}

/**
 * Password Login Rate Limit service를 생성한다.
 *
 * Store를 주입받아 operation 정책과 저장 구현을 분리한다.
 *
 * @param store Auth Rate Limit Store
 * @returns Password Login Rate Limit service
 */
export function createLoginRateLimit(store: AuthRateLimitStore) {
  return {
    /**
     * 실제 Password Login Provider operation을 시작할 수 있는지 확인하고,
     * 허용된 경우 Email/IP attempt를 같은 atomic section에서 소비한다.
     *
     * 확인 순서:
     * - Email rolling 10 / 5분
     * - IP rolling 20 / 1분
     * - IP rolling 100 / 15분
     * - active failure streak 5회
     *
     * 하나라도 차단되면 어떤 상태도 변경하지 않는다.
     *
     * @param input Password Login identity와 평가 시각
     * @returns Provider operation 시작 허용 여부
     */
    tryStartAttempt(
      input: TryStartLoginAttemptInput,
    ): LoginRateLimitStartResult {
      const now = input.now ?? Date.now();
      const emailKey = getLoginEmailAttemptKey(input.canonicalEmail);
      const ipKey = getLoginIpAttemptKey(input.ip);
      const streakKey = getLoginFailureStreakKey(input.canonicalEmail);

      return store.runAtomic(() => {
        const emailState = store.getTimestampWindow(emailKey) ?? [];
        const ipState = store.getTimestampWindow(ipKey) ?? [];

        // 먼저 모든 window를 read-only로 평가한다.
        // 실제 append는 모든 조건이 통과한 뒤 한 번에 수행한다.
        const emailEvaluation = evaluateSlidingWindow(
          emailState,
          LOGIN_EMAIL_ATTEMPT_LIMIT,
          LOGIN_EMAIL_ATTEMPT_WINDOW_MS,
          now,
          { appendOnAllow: false },
        );

        const ipShortEvaluation = evaluateSlidingWindow(
          ipState,
          LOGIN_IP_SHORT_LIMIT,
          LOGIN_IP_SHORT_WINDOW_MS,
          now,
          { appendOnAllow: false },
        );

        const ipLongEvaluation = evaluateSlidingWindow(
          ipState,
          LOGIN_IP_LONG_LIMIT,
          LOGIN_IP_LONG_WINDOW_MS,
          now,
          { appendOnAllow: false },
        );

        const streak = store.getFailureStreak(streakKey);

        // inactivity가 지나지 않은 streak만 현재 연속 실패로 인정한다.
        const activeStreak =
          streak &&
          now - streak.lastFailureAt <
            LOGIN_FAILURE_STREAK_INACTIVITY_MS
            ? streak
            : undefined;

        if (!emailEvaluation.allowed) {
          return {
            allowed: false,
            blockedBy: "email_attempt",
          };
        }

        if (!ipShortEvaluation.allowed) {
          return {
            allowed: false,
            blockedBy: "ip_short",
          };
        }

        if (!ipLongEvaluation.allowed) {
          return {
            allowed: false,
            blockedBy: "ip_long",
          };
        }

        if (
          activeStreak &&
          activeStreak.count >= LOGIN_FAILURE_STREAK_LIMIT
        ) {
          return {
            allowed: false,
            blockedBy: "failure_streak",
          };
        }

        // 모든 check가 통과한 경우에만 Email/IP attempt를 함께 소비한다.
        store.setTimestampWindow(emailKey, [
          ...emailEvaluation.pruned,
          now,
        ]);

        // IP short/long은 같은 attempt collection을 공유한다.
        // 가장 긴 long window 기준 상태를 보존하면 short window는 조회 시 prune할 수 있다.
        store.setTimestampWindow(ipKey, [
          ...ipLongEvaluation.pruned,
          now,
        ]);

        // inactivity가 지난 streak는 허용된 새 operation 시작 시 정리한다.
        if (streak && !activeStreak) {
          store.deleteFailureStreak(streakKey);
        }

        return { allowed: true };
      }, now);
    },

    /**
     * 실제 Password Login Provider operation 결과를 failure streak에 반영한다.
     *
     * - success: streak clear
     * - credential_failure: active streak +1 또는 새 streak 시작
     * - non_credential_failure: streak 변경 없음
     *
     * Email/IP total attempt는 `tryStartAttempt()`에서 이미 소비되었으므로
     * Provider 결과에 따라 rollback하지 않는다.
     *
     * @param input Provider operation 결과와 평가 시각
     */
    recordResult(input: RecordLoginResultInput): void {
      // Provider 429/system/transport 결과는 streak에 아무 영향도 주지 않는다.
      if (input.result === "non_credential_failure") {
        return;
      }

      const now = input.now ?? Date.now();
      const streakKey = getLoginFailureStreakKey(
        input.canonicalEmail,
      );

      store.runAtomic(() => {
        if (input.result === "success") {
          store.deleteFailureStreak(streakKey);
          return;
        }

        const current = store.getFailureStreak(streakKey);

        const isActive =
          current !== undefined &&
          now - current.lastFailureAt <
            LOGIN_FAILURE_STREAK_INACTIVITY_MS;

        store.setFailureStreak(streakKey, {
          count: isActive ? current.count + 1 : 1,
          lastFailureAt: now,
        });
      }, now);
    },
  };
}

/**
 * 현재 process에서 사용하는 Password Login Rate Limit singleton.
 */
export const loginRateLimit = createLoginRateLimit(
  inMemoryAuthRateLimitStore,
);
