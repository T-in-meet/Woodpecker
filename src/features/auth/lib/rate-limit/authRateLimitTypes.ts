/**
 * rolling/sliding window quota에서 사용하는 timestamp collection 상태.
 */
export type TimestampWindowState = number[];

/**
 * OTP Verify Email total처럼 단순 fixed window quota에서 사용하는 상태.
 */
export type FixedWindowState = {
  count: number;
  windowStartedAt: number;
};

/**
 * Password Login / OTP Verify의 consecutive failure streak 상태.
 */
export type FailureStreakState = {
  count: number;
  lastFailureAt: number;
};

/**
 * OTP Issue cooldown의 마지막 Provider operation 시작 시각.
 */
export type CooldownState = number;
