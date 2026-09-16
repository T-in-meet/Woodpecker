import type { OtpPurpose } from "@/features/auth/constants/otp";
import {
  OTP_ISSUE_COOLDOWN_MS,
  OTP_ISSUE_EMAIL_SUCCESS_LIMIT,
  OTP_ISSUE_EMAIL_SUCCESS_WINDOW_MS,
  OTP_ISSUE_IP_LONG_LIMIT,
  OTP_ISSUE_IP_LONG_WINDOW_MS,
  OTP_ISSUE_IP_SHORT_LIMIT,
  OTP_ISSUE_IP_SHORT_WINDOW_MS,
} from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import type { AuthRateLimitStore } from "@/features/auth/lib/rate-limit/authRateLimitStore";
import { inMemoryAuthRateLimitStore } from "@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore";
import {
  evaluateSlidingWindow,
  pruneExpired,
} from "@/features/auth/utils/rateLimit.utils";

/**
 * OTP Issue IP attempt key prefix.
 *
 * Signup과 Recovery가 동일 IP quota를 공유한다.
 */
const OTP_ISSUE_IP_ATTEMPT_KEY_PREFIX = "auth:otp-issue:ip:attempt:";

/**
 * OTP Issue 시작 차단 원인.
 *
 * 외부 응답 contract가 아니라 OTP Issue operation 내부 판정용 값이다.
 */
export type OtpIssueRateLimitBlockedBy =
  | "email_success"
  | "cooldown"
  | "ip_short"
  | "ip_long"
  | "in_flight";

export type OtpIssueIpRateLimitBlockedBy = Extract<
  OtpIssueRateLimitBlockedBy,
  "ip_short" | "ip_long"
>;

/**
 * OTP Issue 시작 판정 결과.
 */
export type OtpIssueRateLimitStartResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      blockedBy: OtpIssueRateLimitBlockedBy;
    };

/**
 * OTP Issue IP-only 사전 판정 결과.
 */
export type OtpIssueIpPrecheckResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      blockedBy: OtpIssueIpRateLimitBlockedBy;
    };

/**
 * OTP Issue 시작 입력.
 */
type TryStartOtpIssueInput = {
  purpose: OtpPurpose;
  canonicalEmail: string;
  ip: string;
  now?: number;
};

/**
 * OTP Issue IP-only 사전 판정 입력.
 */
type PrecheckOtpIssueIpInput = {
  ip: string;
  now?: number;
};

/**
 * 성공한 OTP Issue 기록 입력.
 */
type RecordSuccessfulOtpIssueInput = {
  purpose: OtpPurpose;
  canonicalEmail: string;
  now?: number;
};

/**
 * OTP Issue in-flight 해제 입력.
 */
type ReleaseOtpIssueInput = {
  purpose: OtpPurpose;
  canonicalEmail: string;
  now?: number;
};

type OtpIssueIpEvaluation = {
  result: OtpIssueIpPrecheckResult;
  prunedLongWindow: number[];
};

type OtpIssueEvaluation = {
  result: OtpIssueRateLimitStartResult;
  prunedIpLongWindow: number[];
};

/**
 * OTP Issue successful Email quota key를 생성한다.
 *
 * @param purpose OTP Issue 목적
 * @param canonicalEmail 정규화된 이메일
 * @returns successful Email quota Store key
 */
function getOtpIssueEmailSuccessKey(
  purpose: OtpPurpose,
  canonicalEmail: string,
): string {
  return `auth:otp-issue:${purpose}:email:success:${canonicalEmail}`;
}

/**
 * OTP Issue cooldown key를 생성한다.
 *
 * @param purpose OTP Issue 목적
 * @param canonicalEmail 정규화된 이메일
 * @returns cooldown Store key
 */
function getOtpIssueCooldownKey(
  purpose: OtpPurpose,
  canonicalEmail: string,
): string {
  return `auth:otp-issue:${purpose}:email:cooldown:${canonicalEmail}`;
}

/**
 * OTP Issue in-flight key를 생성한다.
 *
 * @param purpose OTP Issue 목적
 * @param canonicalEmail 정규화된 이메일
 * @returns in-flight Store key
 */
function getOtpIssueInFlightKey(
  purpose: OtpPurpose,
  canonicalEmail: string,
): string {
  return `auth:otp-issue:${purpose}:email:in-flight:${canonicalEmail}`;
}

/**
 * OTP Issue IP attempt key를 생성한다.
 *
 * @param ip 신뢰 가능한 사용자 IP
 * @returns IP attempt Store key
 */
function getOtpIssueIpAttemptKey(ip: string): string {
  return `${OTP_ISSUE_IP_ATTEMPT_KEY_PREFIX}${ip}`;
}

/**
 * OTP Issue shared IP quota를 평가한다.
 *
 * 이 함수는 순수 판정만 수행하며 Store를 변경하지 않는다.
 */
function evaluateOtpIssueIpState(
  ipState: number[],
  now: number,
): OtpIssueIpEvaluation {
  const ipShortEvaluation = evaluateSlidingWindow(
    ipState,
    OTP_ISSUE_IP_SHORT_LIMIT,
    OTP_ISSUE_IP_SHORT_WINDOW_MS,
    now,
    { appendOnAllow: false },
  );

  const ipLongEvaluation = evaluateSlidingWindow(
    ipState,
    OTP_ISSUE_IP_LONG_LIMIT,
    OTP_ISSUE_IP_LONG_WINDOW_MS,
    now,
    { appendOnAllow: false },
  );

  if (!ipShortEvaluation.allowed) {
    return {
      result: {
        allowed: false,
        blockedBy: "ip_short",
      },
      prunedLongWindow: ipLongEvaluation.pruned,
    };
  }

  if (!ipLongEvaluation.allowed) {
    return {
      result: {
        allowed: false,
        blockedBy: "ip_long",
      },
      prunedLongWindow: ipLongEvaluation.pruned,
    };
  }

  return {
    result: { allowed: true },
    prunedLongWindow: ipLongEvaluation.pruned,
  };
}

/**
 * OTP Issue 전체 시작 조건을 평가한다.
 *
 * Email-specific 상태와 shared IP 상태를 동일한 blocker 우선순위로 평가한다.
 * 이 함수는 순수 판정만 수행하며 Store를 변경하지 않는다.
 */
function evaluateOtpIssueState(input: {
  emailSuccessState: number[];
  ipState: number[];
  lastStartedAt: number | undefined;
  hasInFlight: boolean;
  now: number;
}): OtpIssueEvaluation {
  const emailSuccessEvaluation = evaluateSlidingWindow(
    input.emailSuccessState,
    OTP_ISSUE_EMAIL_SUCCESS_LIMIT,
    OTP_ISSUE_EMAIL_SUCCESS_WINDOW_MS,
    input.now,
    { appendOnAllow: false },
  );

  if (!emailSuccessEvaluation.allowed) {
    return {
      result: {
        allowed: false,
        blockedBy: "email_success",
      },
      prunedIpLongWindow: evaluateOtpIssueIpState(input.ipState, input.now)
        .prunedLongWindow,
    };
  }

  const cooldownActive =
    input.lastStartedAt !== undefined &&
    input.now - input.lastStartedAt < OTP_ISSUE_COOLDOWN_MS;

  if (cooldownActive) {
    return {
      result: {
        allowed: false,
        blockedBy: "cooldown",
      },
      prunedIpLongWindow: evaluateOtpIssueIpState(input.ipState, input.now)
        .prunedLongWindow,
    };
  }

  const ipEvaluation = evaluateOtpIssueIpState(input.ipState, input.now);
  if (!ipEvaluation.result.allowed) {
    return {
      result: ipEvaluation.result,
      prunedIpLongWindow: ipEvaluation.prunedLongWindow,
    };
  }

  if (input.hasInFlight) {
    return {
      result: {
        allowed: false,
        blockedBy: "in_flight",
      },
      prunedIpLongWindow: ipEvaluation.prunedLongWindow,
    };
  }

  return {
    result: { allowed: true },
    prunedIpLongWindow: ipEvaluation.prunedLongWindow,
  };
}

/**
 * OTP Issue Rate Limit service를 생성한다.
 *
 * Email 상태는 purpose별로 분리하고 IP attempt는 두 purpose가 공유한다.
 * Store를 주입받아 operation 정책과 저장 구현을 분리한다.
 *
 * @param store Auth Rate Limit Store
 * @returns OTP Issue Rate Limit service
 */
export function createOtpIssueRateLimit(store: AuthRateLimitStore) {
  return {
    /**
     * Account-dependent I/O 전에 현재 상태에서 이미 차단된 요청을 판정한다.
     *
     * read-only precheck이므로 어떤 Rate Limit 상태도 변경하지 않는다.
     * `allowed`는 Provider 시작 허가가 아니며, 실제 시작 직전 반드시
     * `tryStartIssue()`의 atomic 최종 판정을 다시 받아야 한다.
     */
    precheckIssue(input: TryStartOtpIssueInput): OtpIssueRateLimitStartResult {
      const now = input.now ?? Date.now();
      const emailSuccessKey = getOtpIssueEmailSuccessKey(
        input.purpose,
        input.canonicalEmail,
      );
      const cooldownKey = getOtpIssueCooldownKey(
        input.purpose,
        input.canonicalEmail,
      );
      const inFlightKey = getOtpIssueInFlightKey(
        input.purpose,
        input.canonicalEmail,
      );
      const ipKey = getOtpIssueIpAttemptKey(input.ip);

      return evaluateOtpIssueState({
        emailSuccessState: store.getTimestampWindow(emailSuccessKey) ?? [],
        ipState: store.getTimestampWindow(ipKey) ?? [],
        lastStartedAt: store.getCooldown(cooldownKey),
        hasInFlight: store.hasInFlight(inFlightKey),
        now,
      }).result;
    },

    /**
     * Signup Resend의 account lookup 전에 shared IP quota만 사전 판정한다.
     *
     * Email-specific 상태를 보지 않으며 어떤 상태도 변경하지 않는다.
     * `allowed`는 Provider 시작 허가가 아니다.
     */
    precheckIpIssue(input: PrecheckOtpIssueIpInput): OtpIssueIpPrecheckResult {
      const now = input.now ?? Date.now();
      const ipKey = getOtpIssueIpAttemptKey(input.ip);

      return evaluateOtpIssueIpState(store.getTimestampWindow(ipKey) ?? [], now)
        .result;
    },

    /**
     * 실제 OTP Issue Provider operation을 시작할 수 있는지 확인한다.
     *
     * 모든 조건을 통과한 경우에만 같은 atomic section에서:
     * - in-flight 획득
     * - cooldown 소비
     * - IP attempt 소비
     *
     * 를 함께 수행한다.
     *
     * successful Email quota는 실제 Issue 성공이 확정된 뒤
     * `recordSuccessfulIssue()`에서 별도로 소비한다.
     *
     * @param input OTP Issue identity와 평가 시각
     * @returns Provider operation 시작 허용 여부
     */
    tryStartIssue(input: TryStartOtpIssueInput): OtpIssueRateLimitStartResult {
      const now = input.now ?? Date.now();

      const emailSuccessKey = getOtpIssueEmailSuccessKey(
        input.purpose,
        input.canonicalEmail,
      );
      const cooldownKey = getOtpIssueCooldownKey(
        input.purpose,
        input.canonicalEmail,
      );
      const inFlightKey = getOtpIssueInFlightKey(
        input.purpose,
        input.canonicalEmail,
      );
      const ipKey = getOtpIssueIpAttemptKey(input.ip);

      return store.runAtomic(() => {
        const evaluation = evaluateOtpIssueState({
          emailSuccessState: store.getTimestampWindow(emailSuccessKey) ?? [],
          ipState: store.getTimestampWindow(ipKey) ?? [],
          lastStartedAt: store.getCooldown(cooldownKey),
          hasInFlight: store.hasInFlight(inFlightKey),
          now,
        });

        if (!evaluation.result.allowed) {
          return evaluation.result;
        }

        // 모든 check가 통과한 뒤에만 상태를 함께 변경한다.
        // 이 atomic section이 끝난 직후 호출부는 다른 await/I/O 없이
        // 실제 OTP Issue Provider operation을 시작해야 한다.
        store.addInFlight(inFlightKey);
        store.setCooldown(cooldownKey, now);

        // IP short/long은 같은 timestamp collection을 공유한다.
        store.setTimestampWindow(ipKey, [
          ...evaluation.prunedIpLongWindow,
          now,
        ]);

        return { allowed: true };
      }, now);
    },

    /**
     * OTP 발급과 Email 전송이 모두 성공한 경우에만
     * successful Email quota를 1회 기록한다.
     *
     * @param input 성공한 OTP Issue identity와 평가 시각
     */
    recordSuccessfulIssue(input: RecordSuccessfulOtpIssueInput): void {
      const now = input.now ?? Date.now();
      const emailSuccessKey = getOtpIssueEmailSuccessKey(
        input.purpose,
        input.canonicalEmail,
      );

      store.runAtomic(() => {
        const current = store.getTimestampWindow(emailSuccessKey) ?? [];

        const pruned = pruneExpired(
          current,
          OTP_ISSUE_EMAIL_SUCCESS_WINDOW_MS,
          now,
        );

        // 이 함수 호출 자체가 실제 성공 확정을 의미하므로 1회를 기록한다.
        store.setTimestampWindow(emailSuccessKey, [...pruned, now]);
      }, now);
    },

    /**
     * 동일 purpose + canonicalEmail의 OTP Issue in-flight 상태를 해제한다.
     *
     * 실제 OTP Issue 흐름에서는 성공/실패/예외와 관계없이
     * 반드시 finally에서 호출해야 한다.
     *
     * @param input OTP Issue identity와 평가 시각
     */
    releaseIssue(input: ReleaseOtpIssueInput): void {
      const now = input.now ?? Date.now();
      const inFlightKey = getOtpIssueInFlightKey(
        input.purpose,
        input.canonicalEmail,
      );

      store.runAtomic(() => {
        store.deleteInFlight(inFlightKey);
      }, now);
    },
  };
}

/**
 * 현재 process에서 사용하는 OTP Issue Rate Limit singleton.
 */
export const otpIssueRateLimit = createOtpIssueRateLimit(
  inMemoryAuthRateLimitStore,
);
