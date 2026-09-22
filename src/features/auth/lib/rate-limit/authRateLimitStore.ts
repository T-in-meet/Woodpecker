import type {
  CooldownState,
  FailureStreakState,
  FixedWindowState,
  TimestampWindowState,
} from "./authRateLimitTypes";

/**
 * Auth Rate Limit 상태 저장소 계약.
 *
 * operation별 Rate Limit service는 raw Map/Set에 직접 접근하지 않고
 * 이 저장소를 통해 상태를 조회하고 변경한다.
 *
 * 여러 상태를 함께 확인하고 변경해야 하는 작업은 `runAtomic()` 안에서 수행한다.
 * 현재 InMemory 구현에서 이 구간은 await와 외부 I/O가 없는
 * synchronous critical section으로 구현한다.
 */
export type AuthRateLimitStore = {
  /**
   * 하나의 Rate Limit 상태 전환을 동기적으로 실행한다.
   *
   * callback 안에서는 필요한 조건을 모두 확인한 뒤 상태를 변경해야 하며,
   * 조건이 하나라도 실패한 경우 관련 상태를 부분적으로 변경하지 않는다.
   *
   * `now`를 전달하면 opportunistic cleanup도 같은 논리 시각을 사용한다.
   * 생략하면 Production 기본값으로 현재 시각을 사용한다.
   */
  runAtomic<T>(operation: () => T, now?: number): T;

  /**
   * rolling/sliding window의 timestamp 상태를 조회한다.
   */
  getTimestampWindow(key: string): TimestampWindowState | undefined;

  /**
   * rolling/sliding window의 timestamp 상태를 저장한다.
   */
  setTimestampWindow(key: string, state: TimestampWindowState): void;

  /**
   * rolling/sliding window 상태를 제거한다.
   */
  deleteTimestampWindow(key: string): void;

  /**
   * simple fixed window 상태를 조회한다.
   */
  getFixedWindow(key: string): FixedWindowState | undefined;

  /**
   * simple fixed window 상태를 저장한다.
   */
  setFixedWindow(key: string, state: FixedWindowState): void;

  /**
   * simple fixed window 상태를 제거한다.
   */
  deleteFixedWindow(key: string): void;

  /**
   * consecutive failure streak 상태를 조회한다.
   */
  getFailureStreak(key: string): FailureStreakState | undefined;

  /**
   * consecutive failure streak 상태를 저장한다.
   */
  setFailureStreak(key: string, state: FailureStreakState): void;

  /**
   * consecutive failure streak 상태를 제거한다.
   */
  deleteFailureStreak(key: string): void;

  /**
   * OTP Issue의 마지막 Provider operation 시작 시각을 조회한다.
   */
  getCooldown(key: string): CooldownState | undefined;

  /**
   * OTP Issue의 마지막 Provider operation 시작 시각을 저장한다.
   */
  setCooldown(key: string, state: CooldownState): void;

  /**
   * OTP Issue cooldown 상태를 제거한다.
   */
  deleteCooldown(key: string): void;

  /**
   * OTP Issue가 동일 key로 실행 중인지 확인한다.
   */
  hasInFlight(key: string): boolean;

  /**
   * OTP Issue in-flight 상태를 추가한다.
   */
  addInFlight(key: string): void;

  /**
   * OTP Issue in-flight 상태를 제거한다.
   */
  deleteInFlight(key: string): void;
};
