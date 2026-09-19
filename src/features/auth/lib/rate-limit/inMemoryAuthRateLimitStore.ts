import { pruneExpired } from "@/features/auth/utils/rateLimit.utils";

import {
  AUTH_GLOBAL_REQUEST_IP_LONG_WINDOW_MS,
  LOGIN_EMAIL_ATTEMPT_WINDOW_MS,
  LOGIN_FAILURE_STREAK_INACTIVITY_MS,
  LOGIN_IP_LONG_WINDOW_MS,
  OTP_ISSUE_COOLDOWN_MS,
  OTP_ISSUE_EMAIL_ATTEMPT_WINDOW_MS,
  OTP_ISSUE_EMAIL_SUCCESS_WINDOW_MS,
  OTP_ISSUE_IP_LONG_WINDOW_MS,
  OTP_VERIFY_EMAIL_ATTEMPT_WINDOW_MS,
  OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS,
  OTP_VERIFY_IP_LONG_WINDOW_MS,
} from "./authRateLimitConstants";
import type { AuthRateLimitStore } from "./authRateLimitStore";
import type {
  CooldownState,
  FailureStreakState,
  FixedWindowState,
  TimestampWindowState,
} from "./authRateLimitTypes";

/**
 * InMemory Store의 opportunistic cleanup 최소 실행 간격.
 *
 * mutation마다 cleanup 여부는 확인하되,
 * 전체 Store scan은 최대 1분에 한 번만 실행한다.
 */
const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * timestamp 기반 상태의 최대 보존 시간.
 *
 * 정확한 Rate Limit window 판정은 operation별 service가 담당한다.
 * global cleanup은 다시 접근되지 않는 상태의 메모리 회수만 담당하므로,
 * timestamp 상태에 사용되는 가장 긴 window를 기준으로 정리한다.
 */
const TIMESTAMP_RETENTION_MS = Math.max(
  AUTH_GLOBAL_REQUEST_IP_LONG_WINDOW_MS,
  LOGIN_EMAIL_ATTEMPT_WINDOW_MS,
  LOGIN_IP_LONG_WINDOW_MS,
  OTP_ISSUE_EMAIL_ATTEMPT_WINDOW_MS,
  OTP_ISSUE_EMAIL_SUCCESS_WINDOW_MS,
  OTP_ISSUE_IP_LONG_WINDOW_MS,
  OTP_VERIFY_IP_LONG_WINDOW_MS,
);

/**
 * fixed window 상태의 최대 보존 시간.
 *
 * 현재 fixed window는 OTP Verify Email total에서 사용한다.
 */
const FIXED_WINDOW_RETENTION_MS = OTP_VERIFY_EMAIL_ATTEMPT_WINDOW_MS;

/**
 * failure streak 상태의 최대 보존 시간.
 *
 * Login과 OTP Verify 중 더 긴 inactivity 기준으로
 * 다시 접근되지 않는 stale streak를 정리한다.
 */
const FAILURE_STREAK_RETENTION_MS = Math.max(
  LOGIN_FAILURE_STREAK_INACTIVITY_MS,
  OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS,
);

/**
 * cooldown 상태의 최대 보존 시간.
 *
 * 현재 cooldown은 OTP Issue에서 사용한다.
 */
const COOLDOWN_RETENTION_MS = OTP_ISSUE_COOLDOWN_MS;

/**
 * InMemory Auth Rate Limit Store를 생성한다.
 *
 * Store instance마다 독립적인 process-local 상태를 가진다.
 * raw Map/Set은 이 구현 내부에서만 관리하고 외부에 노출하지 않는다.
 *
 * @returns InMemory Auth Rate Limit Store
 */
export function createInMemoryAuthRateLimitStore(): AuthRateLimitStore {
  /**
   * rolling/sliding window timestamp 상태 저장소.
   */
  const timestampWindowStore = new Map<string, TimestampWindowState>();

  /**
   * simple fixed window 상태 저장소.
   */
  const fixedWindowStore = new Map<string, FixedWindowState>();

  /**
   * consecutive authentication failure streak 상태 저장소.
   */
  const failureStreakStore = new Map<string, FailureStreakState>();

  /**
   * OTP Issue cooldown 상태 저장소.
   */
  const cooldownStore = new Map<string, CooldownState>();

  /**
   * 현재 실행 중인 OTP Issue key 저장소.
   *
   * in-flight 상태는 시간 기반 cleanup으로 자동 제거하지 않는다.
   */
  const inFlightStore = new Set<string>();

  /**
   * 마지막 opportunistic cleanup 실행 시각.
   *
   * null이면 아직 cleanup을 실행하지 않은 상태다.
   */
  let lastCleanupAt: number | null = null;

  /**
   * 현재 `runAtomic()` callback 실행 여부.
   *
   * atomic callback 내부의 여러 mutation 사이에는 global cleanup을 실행하지 않는다.
   */
  let isRunningAtomicOperation = false;

  /**
   * 오래된 timestamp 상태를 정리한다.
   *
   * @param now 현재 시각
   */
  function cleanupTimestampWindows(now: number): void {
    for (const [key, timestamps] of timestampWindowStore.entries()) {
      // 최대 보존 시간을 지난 timestamp를 제거한다.
      const pruned = pruneExpired(timestamps, TIMESTAMP_RETENTION_MS, now);

      // 유효한 timestamp가 하나도 없으면 key 전체를 제거한다.
      if (pruned.length === 0) {
        timestampWindowStore.delete(key);
        continue;
      }

      timestampWindowStore.set(key, pruned);
    }
  }

  /**
   * 만료된 fixed window 상태를 정리한다.
   *
   * @param now 현재 시각
   */
  function cleanupFixedWindows(now: number): void {
    for (const [key, state] of fixedWindowStore.entries()) {
      // 최대 보존 시간이 지난 fixed window를 제거한다.
      if (now - state.windowStartedAt >= FIXED_WINDOW_RETENTION_MS) {
        fixedWindowStore.delete(key);
      }
    }
  }

  /**
   * 장기간 사용되지 않은 failure streak 상태를 정리한다.
   *
   * @param now 현재 시각
   */
  function cleanupFailureStreaks(now: number): void {
    for (const [key, state] of failureStreakStore.entries()) {
      // 가장 긴 inactivity 기준까지 지난 stale streak를 제거한다.
      if (now - state.lastFailureAt >= FAILURE_STREAK_RETENTION_MS) {
        failureStreakStore.delete(key);
      }
    }
  }

  /**
   * 만료된 OTP Issue cooldown 상태를 정리한다.
   *
   * @param now 현재 시각
   */
  function cleanupCooldowns(now: number): void {
    for (const [key, lastStartedAt] of cooldownStore.entries()) {
      // cooldown 시간이 지난 뒤 다시 사용되지 않은 key를 제거한다.
      if (now - lastStartedAt >= COOLDOWN_RETENTION_MS) {
        cooldownStore.delete(key);
      }
    }
  }

  /**
   * cleanup interval이 경과한 경우 stale 상태를 정리한다.
   *
   * @param now 현재 시각
   */
  function maybeCleanup(now: number): void {
    // 아직 cleanup interval이 지나지 않았다면 전체 scan을 생략한다.
    if (lastCleanupAt !== null && now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
      return;
    }

    lastCleanupAt = now;

    // 시간 기반으로 만료 가능한 상태만 정리한다.
    cleanupTimestampWindows(now);
    cleanupFixedWindows(now);
    cleanupFailureStreaks(now);
    cleanupCooldowns(now);
  }

  /**
   * 일반 mutation 전에 opportunistic cleanup을 시도한다.
   *
   * atomic callback 내부에서는 `runAtomic()` 시작 직전 cleanup으로 갈음한다.
   */
  function cleanupBeforeMutation(): void {
    if (isRunningAtomicOperation) {
      return;
    }

    maybeCleanup(Date.now());
  }

  return {
    /**
     * 하나의 Rate Limit 상태 전환을 동기적으로 실행한다.
     *
     * callback 시작 전에 opportunistic cleanup을 수행하고,
     * callback 내부의 mutation 사이에는 추가 cleanup을 실행하지 않는다.
     */
    runAtomic<T>(operation: () => T, now = Date.now()): T {
      // Rate Limit service가 주입한 논리 시각과 cleanup 시각을 일치시킨다.
      maybeCleanup(now);
      isRunningAtomicOperation = true;

      try {
        return operation();
      } finally {
        isRunningAtomicOperation = false;
      }
    },

    /**
     * rolling/sliding window timestamp 상태를 조회한다.
     */
    getTimestampWindow(key: string): TimestampWindowState | undefined {
      const state = timestampWindowStore.get(key);

      // 외부 mutation이 내부 Store 상태를 변경하지 않도록 복사한다.
      return state ? [...state] : undefined;
    },

    /**
     * rolling/sliding window timestamp 상태를 저장한다.
     */
    setTimestampWindow(key: string, state: TimestampWindowState): void {
      cleanupBeforeMutation();

      // 빈 timestamp 상태는 key를 유지하지 않는다.
      if (state.length === 0) {
        timestampWindowStore.delete(key);
        return;
      }

      timestampWindowStore.set(key, [...state]);
    },

    /**
     * rolling/sliding window 상태를 제거한다.
     */
    deleteTimestampWindow(key: string): void {
      cleanupBeforeMutation();
      timestampWindowStore.delete(key);
    },

    /**
     * simple fixed window 상태를 조회한다.
     */
    getFixedWindow(key: string): FixedWindowState | undefined {
      const state = fixedWindowStore.get(key);

      // 내부 객체 참조를 직접 노출하지 않는다.
      return state ? { ...state } : undefined;
    },

    /**
     * simple fixed window 상태를 저장한다.
     */
    setFixedWindow(key: string, state: FixedWindowState): void {
      cleanupBeforeMutation();
      fixedWindowStore.set(key, { ...state });
    },

    /**
     * simple fixed window 상태를 제거한다.
     */
    deleteFixedWindow(key: string): void {
      cleanupBeforeMutation();
      fixedWindowStore.delete(key);
    },

    /**
     * consecutive failure streak 상태를 조회한다.
     */
    getFailureStreak(key: string): FailureStreakState | undefined {
      const state = failureStreakStore.get(key);

      // 내부 객체 참조를 직접 노출하지 않는다.
      return state ? { ...state } : undefined;
    },

    /**
     * consecutive failure streak 상태를 저장한다.
     */
    setFailureStreak(key: string, state: FailureStreakState): void {
      cleanupBeforeMutation();
      failureStreakStore.set(key, { ...state });
    },

    /**
     * consecutive failure streak 상태를 제거한다.
     */
    deleteFailureStreak(key: string): void {
      cleanupBeforeMutation();
      failureStreakStore.delete(key);
    },

    /**
     * OTP Issue의 마지막 Provider operation 시작 시각을 조회한다.
     */
    getCooldown(key: string): CooldownState | undefined {
      return cooldownStore.get(key);
    },

    /**
     * OTP Issue의 마지막 Provider operation 시작 시각을 저장한다.
     */
    setCooldown(key: string, state: CooldownState): void {
      cleanupBeforeMutation();
      cooldownStore.set(key, state);
    },

    /**
     * OTP Issue cooldown 상태를 제거한다.
     */
    deleteCooldown(key: string): void {
      cleanupBeforeMutation();
      cooldownStore.delete(key);
    },

    /**
     * 동일 key의 OTP Issue가 실행 중인지 확인한다.
     */
    hasInFlight(key: string): boolean {
      return inFlightStore.has(key);
    },

    /**
     * OTP Issue in-flight 상태를 추가한다.
     */
    addInFlight(key: string): void {
      cleanupBeforeMutation();
      inFlightStore.add(key);
    },

    /**
     * OTP Issue in-flight 상태를 제거한다.
     */
    deleteInFlight(key: string): void {
      cleanupBeforeMutation();
      inFlightStore.delete(key);
    },
  };
}

/**
 * Auth Rate Limit service에서 사용하는 기본 InMemory Store instance.
 *
 * 현재 구현은 process-local best-effort 상태를 유지한다.
 */
export const inMemoryAuthRateLimitStore = createInMemoryAuthRateLimitStore();
