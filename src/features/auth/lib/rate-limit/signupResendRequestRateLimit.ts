import {
  SIGNUP_RESEND_REQUEST_IP_LONG_LIMIT,
  SIGNUP_RESEND_REQUEST_IP_LONG_WINDOW_MS,
  SIGNUP_RESEND_REQUEST_IP_SHORT_LIMIT,
  SIGNUP_RESEND_REQUEST_IP_SHORT_WINDOW_MS,
} from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import type { AuthRateLimitStore } from "@/features/auth/lib/rate-limit/authRateLimitStore";
import { inMemoryAuthRateLimitStore } from "@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore";
import { evaluateSlidingWindow } from "@/features/auth/utils/rateLimit.utils";

const SIGNUP_RESEND_REQUEST_IP_KEY_PREFIX = "auth:signup-resend:request:ip:";

export type SignupResendRequestRateLimitBlockedBy = "ip_short" | "ip_long";

export type SignupResendRequestRateLimitResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      blockedBy: SignupResendRequestRateLimitBlockedBy;
    };

type TryConsumeSignupResendRequestInput = {
  ip: string;
  now?: number;
};

function getSignupResendRequestIpKey(ip: string): string {
  return `${SIGNUP_RESEND_REQUEST_IP_KEY_PREFIX}${ip}`;
}

/**
 * Signup Resend account lookup 전 request-level IP Rate Limit service를 생성한다.
 *
 * OTP Issue Rate Limit과 별도 state를 사용하며,
 * 실제 account lookup으로 진행할 요청만 consume한다.
 */
export function createSignupResendRequestRateLimit(store: AuthRateLimitStore) {
  return {
    /**
     * Signup Resend request-level IP quota를 atomic하게 확인하고 소비한다.
     *
     * short/long window를 모두 통과한 allowed 요청만 timestamp를 기록하고,
     * blocked 요청은 state를 변경하지 않는다.
     */
    tryConsume(
      input: TryConsumeSignupResendRequestInput,
    ): SignupResendRequestRateLimitResult {
      const now = input.now ?? Date.now();
      const ipKey = getSignupResendRequestIpKey(input.ip);

      return store.runAtomic(() => {
        const current = store.getTimestampWindow(ipKey) ?? [];

        const shortEvaluation = evaluateSlidingWindow(
          current,
          SIGNUP_RESEND_REQUEST_IP_SHORT_LIMIT,
          SIGNUP_RESEND_REQUEST_IP_SHORT_WINDOW_MS,
          now,
          { appendOnAllow: false },
        );

        const longEvaluation = evaluateSlidingWindow(
          current,
          SIGNUP_RESEND_REQUEST_IP_LONG_LIMIT,
          SIGNUP_RESEND_REQUEST_IP_LONG_WINDOW_MS,
          now,
          { appendOnAllow: false },
        );

        if (!shortEvaluation.allowed) {
          return {
            allowed: false,
            blockedBy: "ip_short",
          };
        }

        if (!longEvaluation.allowed) {
          return {
            allowed: false,
            blockedBy: "ip_long",
          };
        }

        // long window가 short window를 포함하므로 long prune 결과를
        // 다음 canonical timestamp state로 저장한다.
        store.setTimestampWindow(ipKey, [...longEvaluation.pruned, now]);

        return { allowed: true };
      }, now);
    },
  };
}

export const signupResendRequestRateLimit = createSignupResendRequestRateLimit(
  inMemoryAuthRateLimitStore,
);
