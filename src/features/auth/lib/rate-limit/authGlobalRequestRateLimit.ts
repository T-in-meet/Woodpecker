import {
  AUTH_GLOBAL_REQUEST_IP_LONG_LIMIT,
  AUTH_GLOBAL_REQUEST_IP_LONG_WINDOW_MS,
  AUTH_GLOBAL_REQUEST_IP_SHORT_LIMIT,
  AUTH_GLOBAL_REQUEST_IP_SHORT_WINDOW_MS,
} from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import type { AuthRateLimitStore } from "@/features/auth/lib/rate-limit/authRateLimitStore";
import { inMemoryAuthRateLimitStore } from "@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore";
import { evaluateSlidingWindow } from "@/features/auth/utils/rateLimit.utils";

/**
 * Auth Global shared IP request key prefix.
 */
const AUTH_GLOBAL_REQUEST_IP_KEY_PREFIX = "auth:global:request:ip:";

/**
 * Auth Global request 차단 원인.
 *
 * 외부 public error contract가 아니라 global guard 내부 판정과
 * caller structured logging 매핑에 사용하는 값이다.
 */
export type AuthGlobalRequestRateLimitBlockedBy = "ip_short" | "ip_long";

/**
 * Auth Global request consume 결과.
 */
export type AuthGlobalRequestRateLimitResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      blockedBy: AuthGlobalRequestRateLimitBlockedBy;
    };

/**
 * Auth Global request consume 입력.
 */
type TryConsumeAuthGlobalRequestInput = {
  ip: string;
  now?: number;
};

/**
 * Auth Global shared IP request key를 생성한다.
 *
 * @param ip 신뢰 가능한 사용자 IP
 * @returns shared IP request Store key
 */
function getAuthGlobalRequestIpKey(ip: string): string {
  return `${AUTH_GLOBAL_REQUEST_IP_KEY_PREFIX}${ip}`;
}

/**
 * Auth Global IP Request Guard를 생성한다.
 *
 * Login / Signup / Forgot Password / Resend / Verify OTP가
 * 같은 Store instance를 사용할 때 동일 trusted IP state를 공유한다.
 *
 * 이 service는 Email, purpose, failure streak, cooldown, success quota 같은
 * operation-specific 의미를 소유하지 않는다.
 *
 * @param store Auth Rate Limit Store
 * @returns Auth Global IP Request Guard
 */
export function createAuthGlobalRequestRateLimit(store: AuthRateLimitStore) {
  return {
    /**
     * 현재 Auth request가 shared IP budget을 소비할 수 있는지 확인한다.
     *
     * short/long window를 모두 read-only 평가한 뒤,
     * 두 조건을 모두 통과한 경우에만 같은 atomic section에서
     * request timestamp를 1회 소비한다.
     *
     * allowed 이후의 body/schema/local Rate Limit/Provider 결과와 관계없이
     * 이 service는 consume을 rollback하지 않는다.
     *
     * @param input trusted IP와 평가 시각
     * @returns request 허용 여부
     */
    tryConsume(
      input: TryConsumeAuthGlobalRequestInput,
    ): AuthGlobalRequestRateLimitResult {
      const now = input.now ?? Date.now();
      const ipKey = getAuthGlobalRequestIpKey(input.ip);

      return store.runAtomic(() => {
        const ipState = store.getTimestampWindow(ipKey) ?? [];

        // 같은 timestamp collection을 short/long window에서 각각 평가한다.
        const shortEvaluation = evaluateSlidingWindow(
          ipState,
          AUTH_GLOBAL_REQUEST_IP_SHORT_LIMIT,
          AUTH_GLOBAL_REQUEST_IP_SHORT_WINDOW_MS,
          now,
          { appendOnAllow: false },
        );

        const longEvaluation = evaluateSlidingWindow(
          ipState,
          AUTH_GLOBAL_REQUEST_IP_LONG_LIMIT,
          AUTH_GLOBAL_REQUEST_IP_LONG_WINDOW_MS,
          now,
          { appendOnAllow: false },
        );

        // short가 먼저 차단되면 state를 변경하지 않는다.
        if (!shortEvaluation.allowed) {
          return {
            allowed: false,
            blockedBy: "ip_short",
          };
        }

        // long이 차단되어도 state를 변경하지 않는다.
        if (!longEvaluation.allowed) {
          return {
            allowed: false,
            blockedBy: "ip_long",
          };
        }

        // 모든 check를 통과한 request만 1회 소비한다.
        // 가장 긴 long window 기준 상태를 보존하면 short는 조회 시 prune할 수 있다.
        store.setTimestampWindow(ipKey, [...longEvaluation.pruned, now]);

        return { allowed: true };
      }, now);
    },
  };
}

/**
 * 현재 process에서 사용하는 Auth Global IP Request Guard singleton.
 */
export const authGlobalRequestRateLimit = createAuthGlobalRequestRateLimit(
  inMemoryAuthRateLimitStore,
);
