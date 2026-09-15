import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LOGIN_IP_LONG_WINDOW_MS,
  OTP_ISSUE_COOLDOWN_MS,
  OTP_VERIFY_EMAIL_ATTEMPT_WINDOW_MS,
  OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS,
} from "./authRateLimitConstants";
import type { AuthRateLimitStore } from "./authRateLimitStore";
import { createInMemoryAuthRateLimitStore } from "./inMemoryAuthRateLimitStore";

/**
 * 테스트에서 사용하는 기준 시각.
 */
const BASE_TIME = new Date("2026-01-01T00:00:00.000Z");

describe("createInMemoryAuthRateLimitStore", () => {
  /**
   * 각 테스트에서 사용하는 독립 InMemory Store.
   */
  let store: AuthRateLimitStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);

    store = createInMemoryAuthRateLimitStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("각 상태 유형을 저장하고 조회하고 제거한다", () => {
    const now = Date.now();

    // rolling/sliding window 상태를 검증한다.
    store.setTimestampWindow("timestamp", [now]);
    expect(store.getTimestampWindow("timestamp")).toEqual([now]);

    store.deleteTimestampWindow("timestamp");
    expect(store.getTimestampWindow("timestamp")).toBeUndefined();

    // fixed window 상태를 검증한다.
    store.setFixedWindow("fixed", {
      count: 2,
      windowStartedAt: now,
    });

    expect(store.getFixedWindow("fixed")).toEqual({
      count: 2,
      windowStartedAt: now,
    });

    store.deleteFixedWindow("fixed");
    expect(store.getFixedWindow("fixed")).toBeUndefined();

    // failure streak 상태를 검증한다.
    store.setFailureStreak("streak", {
      count: 3,
      lastFailureAt: now,
    });

    expect(store.getFailureStreak("streak")).toEqual({
      count: 3,
      lastFailureAt: now,
    });

    store.deleteFailureStreak("streak");
    expect(store.getFailureStreak("streak")).toBeUndefined();

    // cooldown 상태를 검증한다.
    store.setCooldown("cooldown", now);
    expect(store.getCooldown("cooldown")).toBe(now);

    store.deleteCooldown("cooldown");
    expect(store.getCooldown("cooldown")).toBeUndefined();

    // in-flight 상태를 검증한다.
    store.addInFlight("in-flight");
    expect(store.hasInFlight("in-flight")).toBe(true);

    store.deleteInFlight("in-flight");
    expect(store.hasInFlight("in-flight")).toBe(false);
  });

  it("빈 timestamp 상태는 key를 유지하지 않는다", () => {
    const now = Date.now();

    // 기존 상태를 빈 배열로 교체하면 key 자체를 제거한다.
    store.setTimestampWindow("timestamp", [now]);
    store.setTimestampWindow("timestamp", []);

    expect(store.getTimestampWindow("timestamp")).toBeUndefined();
  });

  it("조회한 배열과 객체를 변경해도 Store 내부 상태는 변경되지 않는다", () => {
    const now = Date.now();

    // timestamp 조회 결과가 내부 배열과 분리되어 있는지 확인한다.
    store.setTimestampWindow("timestamp", [now]);

    const timestamps = store.getTimestampWindow("timestamp");
    timestamps?.push(now + 1);

    expect(store.getTimestampWindow("timestamp")).toEqual([now]);

    // 객체 상태도 내부 참조와 분리되어 있는지 확인한다.
    store.setFailureStreak("streak", {
      count: 1,
      lastFailureAt: now,
    });

    const streak = store.getFailureStreak("streak");

    if (streak) {
      streak.count = 10;
    }

    expect(store.getFailureStreak("streak")).toEqual({
      count: 1,
      lastFailureAt: now,
    });
  });

  it("runAtomic 안에서 여러 상태를 동기적으로 변경한다", () => {
    const now = Date.now();

    const result = store.runAtomic(() => {
      // 모든 check가 끝난 뒤 관련 상태를 같은 callback에서 변경한다.
      expect(store.getTimestampWindow("email")).toBeUndefined();
      expect(store.hasInFlight("issue")).toBe(false);

      store.setTimestampWindow("email", [now]);
      store.setCooldown("cooldown", now);
      store.addInFlight("issue");

      return "allowed";
    });

    expect(result).toBe("allowed");
    expect(store.getTimestampWindow("email")).toEqual([now]);
    expect(store.getCooldown("cooldown")).toBe(now);
    expect(store.hasInFlight("issue")).toBe(true);
  });

  it("cleanup interval 이후 stale 상태를 opportunistic하게 제거한다", () => {
    const now = Date.now();

    // 첫 mutation에서 cleanup 기준 시각을 설정한다.
    store.setTimestampWindow("active", [now]);

    // 같은 cleanup interval 안에서 stale 상태를 준비한다.
    store.setTimestampWindow("stale-timestamp", [
      now - LOGIN_IP_LONG_WINDOW_MS - 1,
    ]);
    store.setFixedWindow("stale-fixed", {
      count: 5,
      windowStartedAt: now - OTP_VERIFY_EMAIL_ATTEMPT_WINDOW_MS - 1,
    });
    store.setFailureStreak("stale-streak", {
      count: 5,
      lastFailureAt: now - OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS - 1,
    });
    store.setCooldown("stale-cooldown", now - OTP_ISSUE_COOLDOWN_MS - 1);
    store.addInFlight("active-in-flight");

    // 1분 뒤 다음 mutation에서 global cleanup이 실행된다.
    vi.advanceTimersByTime(60 * 1000);
    store.setCooldown("cleanup-trigger", Date.now());

    expect(store.getTimestampWindow("stale-timestamp")).toBeUndefined();
    expect(store.getFixedWindow("stale-fixed")).toBeUndefined();
    expect(store.getFailureStreak("stale-streak")).toBeUndefined();
    expect(store.getCooldown("stale-cooldown")).toBeUndefined();

    // in-flight는 시간 기반 cleanup 대상으로 제거하지 않는다.
    expect(store.hasInFlight("active-in-flight")).toBe(true);
  });

  it("runAtomic에 주입한 now를 opportunistic cleanup 기준으로 사용한다", () => {
    const logicalNow = 1_000_000;

    // 실제 system clock과 무관한 논리 시각으로 상태를 생성한다.
    store.runAtomic(() => {
      store.setTimestampWindow("timestamp", [logicalNow]);
    }, logicalNow);

    expect(store.getTimestampWindow("timestamp")).toEqual([logicalNow]);

    // 같은 논리 시계를 기준으로 retention을 넘기면 cleanup되어야 한다.
    store.runAtomic(
      () => undefined,
      logicalNow + LOGIN_IP_LONG_WINDOW_MS + 1,
    );

    expect(store.getTimestampWindow("timestamp")).toBeUndefined();
  });
});
