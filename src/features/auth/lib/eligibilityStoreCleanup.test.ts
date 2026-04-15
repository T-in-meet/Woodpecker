/**
 * Cleanup functionality tests — 만료된 rate limit 항목 정리
 *
 * 테스트 범위:
 * - IP store 만료 항목 제거
 * - Email store 부분 정리 (개별 윈도우 만료)
 * - Email store 완전 제거 (양쪽 윈도우 모두 만료)
 * - 스로틀링 동작 (1분 간격 강제)
 *
 * 주의:
 * - 이 테스트는 cleanup만 검증하며, rate limit 로직은 변경하지 않음
 * - checkRequestEligibility 함수는 테스트하지 않음 (기존 테스트에서 이미 검증)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMAIL_LONG_WINDOW_MS,
  EMAIL_SHORT_WINDOW_MS,
  IP_WINDOW_MS,
  resetEligibilityStore,
} from "./checkRequestEligibility";
import { emailStore, ipStore } from "./requestEligibilityStore";
import { tryCleanupExpiredEntries } from "./requestEligibilityStore";

describe("Eligibility Store Cleanup", () => {
  beforeEach(() => {
    resetEligibilityStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("IP store cleanup", () => {
    it("TC-Cleanup-IP-01. 만료된 IP 항목을 제거한다", () => {
      const ip = "10.1.0.1";
      const now = Date.now();

      /**
       * IP 항목 수동 추가 (cleanup 테스트용)
       */
      ipStore.set(ip, {
        count: 5,
        windowStart: now - IP_WINDOW_MS - 1000, // IP_WINDOW_MS보다 1초 이상 이전
      });

      expect(ipStore.has(ip)).toBe(true);

      /**
       * Cleanup 실행
       */
      tryCleanupExpiredEntries(
        IP_WINDOW_MS,
        EMAIL_SHORT_WINDOW_MS,
        EMAIL_LONG_WINDOW_MS,
      );

      /**
       * 만료된 항목이 제거됨
       */
      expect(ipStore.has(ip)).toBe(false);
    });

    it("TC-Cleanup-IP-02. 만료되지 않은 IP 항목은 유지한다", () => {
      const ip = "10.2.0.1";
      const now = Date.now();

      /**
       * 아직 유효한 IP 항목
       */
      ipStore.set(ip, {
        count: 3,
        windowStart: now - IP_WINDOW_MS + 5000, // 아직 5초 남음
      });

      expect(ipStore.has(ip)).toBe(true);

      tryCleanupExpiredEntries(
        IP_WINDOW_MS,
        EMAIL_SHORT_WINDOW_MS,
        EMAIL_LONG_WINDOW_MS,
      );

      /**
       * 유효한 항목은 유지됨
       */
      expect(ipStore.has(ip)).toBe(true);
      expect(ipStore.get(ip)?.count).toBe(3);
    });
  });

  describe("Email store cleanup", () => {
    it("TC-Cleanup-Email-01. 양쪽 윈도우 모두 만료되면 항목을 제거한다", () => {
      const email = "expired@example.com";
      const now = Date.now();

      /**
       * 양쪽 윈도우 모두 만료된 항목
       */
      emailStore.set(email, {
        shortWindow: {
          count: 1,
          windowStart: now - EMAIL_SHORT_WINDOW_MS - 1000,
        },
        longWindow: {
          count: 3,
          windowStart: now - EMAIL_LONG_WINDOW_MS - 1000,
        },
      });

      expect(emailStore.has(email)).toBe(true);

      tryCleanupExpiredEntries(
        IP_WINDOW_MS,
        EMAIL_SHORT_WINDOW_MS,
        EMAIL_LONG_WINDOW_MS,
      );

      /**
       * 양쪽 모두 만료되었으므로 항목 제거
       */
      expect(emailStore.has(email)).toBe(false);
    });

    it("TC-Cleanup-Email-02. short window만 만료되면 null로 설정한다", () => {
      const email = "partial@example.com";
      const now = Date.now();

      /**
       * short는 만료, long은 유효
       */
      emailStore.set(email, {
        shortWindow: {
          count: 1,
          windowStart: now - EMAIL_SHORT_WINDOW_MS - 1000, // 만료
        },
        longWindow: {
          count: 2,
          windowStart: now - EMAIL_LONG_WINDOW_MS + 5000, // 유효 (5초 남음)
        },
      });

      expect(emailStore.has(email)).toBe(true);
      const before = emailStore.get(email);
      expect(before?.shortWindow).not.toBeNull();
      expect(before?.longWindow).not.toBeNull();

      tryCleanupExpiredEntries(
        IP_WINDOW_MS,
        EMAIL_SHORT_WINDOW_MS,
        EMAIL_LONG_WINDOW_MS,
      );

      /**
       * short만 null로 설정되고, long은 유지
       * 항목은 아직 유지됨 (long window가 활성)
       */
      expect(emailStore.has(email)).toBe(true);
      const after = emailStore.get(email);
      expect(after?.shortWindow).toBeNull();
      expect(after?.longWindow).not.toBeNull();
      expect(after?.longWindow?.count).toBe(2);
    });

    it("TC-Cleanup-Email-03. long window만 만료되면 null로 설정한다", () => {
      const email = "longexp@example.com";
      const now = Date.now();

      /**
       * long은 만료, short는 유효
       */
      emailStore.set(email, {
        shortWindow: {
          count: 1,
          windowStart: now - EMAIL_SHORT_WINDOW_MS + 5000, // 유효
        },
        longWindow: {
          count: 5,
          windowStart: now - EMAIL_LONG_WINDOW_MS - 1000, // 만료
        },
      });

      expect(emailStore.has(email)).toBe(true);

      tryCleanupExpiredEntries(
        IP_WINDOW_MS,
        EMAIL_SHORT_WINDOW_MS,
        EMAIL_LONG_WINDOW_MS,
      );

      /**
       * long만 null로 설정되고, short는 유지
       */
      expect(emailStore.has(email)).toBe(true);
      const after = emailStore.get(email);
      expect(after?.shortWindow).not.toBeNull();
      expect(after?.longWindow).toBeNull();
    });

    it("TC-Cleanup-Email-04. 유효한 윈도우를 가진 항목은 유지한다", () => {
      const email = "valid@example.com";
      const now = Date.now();

      /**
       * 양쪽 모두 유효
       */
      emailStore.set(email, {
        shortWindow: {
          count: 1,
          windowStart: now - EMAIL_SHORT_WINDOW_MS + 10000,
        },
        longWindow: {
          count: 3,
          windowStart: now - EMAIL_LONG_WINDOW_MS + 10000,
        },
      });

      tryCleanupExpiredEntries(
        IP_WINDOW_MS,
        EMAIL_SHORT_WINDOW_MS,
        EMAIL_LONG_WINDOW_MS,
      );

      /**
       * 유효한 항목은 그대로 유지
       */
      expect(emailStore.has(email)).toBe(true);
      const after = emailStore.get(email);
      expect(after?.shortWindow).not.toBeNull();
      expect(after?.longWindow).not.toBeNull();
    });

    it("TC-Cleanup-Email-05. 한쪽만 만료되면 entry를 교체하고 반대쪽 값은 보존한다", () => {
      const email = "replace@example.com";
      const now = Date.now();

      const originalEntry = {
        shortWindow: {
          count: 7,
          windowStart: now - EMAIL_SHORT_WINDOW_MS - 1000, // 만료
        },
        longWindow: {
          count: 9,
          windowStart: now - EMAIL_LONG_WINDOW_MS + 20_000, // 유효
        },
      };
      emailStore.set(email, originalEntry);

      tryCleanupExpiredEntries(
        IP_WINDOW_MS,
        EMAIL_SHORT_WINDOW_MS,
        EMAIL_LONG_WINDOW_MS,
      );

      const after = emailStore.get(email);
      expect(after).toBeDefined();
      expect(after).not.toBe(originalEntry); // set(..., newEntry) full replace
      expect(after?.shortWindow).toBeNull();
      expect(after?.longWindow?.count).toBe(9);
      expect(after?.longWindow?.windowStart).toBe(
        originalEntry.longWindow.windowStart,
      );
    });
  });

  describe("Cleanup throttling", () => {
    it("TC-Cleanup-Throttle-01. 같은 분 내 연속 호출은 1회만 실행한다", () => {
      const ip = "10.3.0.1";
      const initialTime = Date.now();

      /**
       * 만료된 항목 추가
       */
      ipStore.set(ip, {
        count: 1,
        windowStart: initialTime - IP_WINDOW_MS - 1000,
      });

      /**
       * 첫 cleanup: 실행됨
       */
      tryCleanupExpiredEntries(
        IP_WINDOW_MS,
        EMAIL_SHORT_WINDOW_MS,
        EMAIL_LONG_WINDOW_MS,
      );
      expect(ipStore.has(ip)).toBe(false);

      /**
       * 같은 분 내 다시 항목 추가 (cleanup이 실행된 후)
       */
      ipStore.set(ip, {
        count: 1,
        windowStart: initialTime - IP_WINDOW_MS - 1000,
      });

      /**
       * 30초 경과 (스로틀링 간격 1분 미충족)
       */
      vi.advanceTimersByTime(30 * 1000);

      /**
       * 두 번째 cleanup: 스로틀링으로 인해 미실행
       * (마지막 cleanup으로부터 30초만 경과했으므로)
       */
      tryCleanupExpiredEntries(
        IP_WINDOW_MS,
        EMAIL_SHORT_WINDOW_MS,
        EMAIL_LONG_WINDOW_MS,
      );

      /**
       * 항목이 여전히 존재 (cleanup 미실행)
       */
      expect(ipStore.has(ip)).toBe(true);
    });

    it("TC-Cleanup-Throttle-02. 1분 이후 호출은 다시 실행된다", () => {
      const ip = "10.4.0.1";
      const initialTime = Date.now();

      /**
       * 만료된 항목 추가
       */
      ipStore.set(ip, {
        count: 1,
        windowStart: initialTime - IP_WINDOW_MS - 1000,
      });

      /**
       * 첫 cleanup
       */
      tryCleanupExpiredEntries(
        IP_WINDOW_MS,
        EMAIL_SHORT_WINDOW_MS,
        EMAIL_LONG_WINDOW_MS,
      );
      expect(ipStore.has(ip)).toBe(false);

      /**
       * 다시 항목 추가
       */
      ipStore.set(ip, {
        count: 1,
        windowStart: Date.now() - IP_WINDOW_MS - 1000,
      });

      /**
       * 1분 이상 경과
       */
      vi.advanceTimersByTime(61 * 1000);

      /**
       * 두 번째 cleanup: 스로틀링 만료로 실행됨
       */
      tryCleanupExpiredEntries(
        IP_WINDOW_MS,
        EMAIL_SHORT_WINDOW_MS,
        EMAIL_LONG_WINDOW_MS,
      );

      /**
       * 항목이 제거됨
       */
      expect(ipStore.has(ip)).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("TC-Cleanup-Edge-01. 빈 store에서 cleanup은 안전하게 실행된다", () => {
      expect(ipStore.size).toBe(0);
      expect(emailStore.size).toBe(0);

      /**
       * 에러 없이 실행됨
       */
      expect(() => {
        tryCleanupExpiredEntries(
          IP_WINDOW_MS,
          EMAIL_SHORT_WINDOW_MS,
          EMAIL_LONG_WINDOW_MS,
        );
      }).not.toThrow();

      expect(ipStore.size).toBe(0);
      expect(emailStore.size).toBe(0);
    });

    it("TC-Cleanup-Edge-02. 다양한 만료 상태의 항목이 정확히 정리된다", () => {
      const now = Date.now();

      /**
       * 여러 IP 항목 추가
       */
      ipStore.set("10.5.0.1", {
        count: 1,
        windowStart: now - IP_WINDOW_MS - 1000, // 만료
      });
      ipStore.set("10.5.0.2", {
        count: 2,
        windowStart: now - IP_WINDOW_MS + 5000, // 유효
      });

      /**
       * 여러 이메일 항목 추가
       */
      emailStore.set("exp1@example.com", {
        shortWindow: {
          count: 1,
          windowStart: now - EMAIL_SHORT_WINDOW_MS - 1000, // 만료
        },
        longWindow: {
          count: 2,
          windowStart: now - EMAIL_LONG_WINDOW_MS - 1000, // 만료
        },
      });

      emailStore.set("exp2@example.com", {
        shortWindow: {
          count: 1,
          windowStart: now - EMAIL_SHORT_WINDOW_MS - 1000, // 만료
        },
        longWindow: {
          count: 3,
          windowStart: now - EMAIL_LONG_WINDOW_MS + 5000, // 유효
        },
      });

      emailStore.set("valid@example.com", {
        shortWindow: {
          count: 1,
          windowStart: now - EMAIL_SHORT_WINDOW_MS + 5000, // 유효
        },
        longWindow: {
          count: 4,
          windowStart: now - EMAIL_LONG_WINDOW_MS + 5000, // 유효
        },
      });

      expect(ipStore.size).toBe(2);
      expect(emailStore.size).toBe(3);

      tryCleanupExpiredEntries(
        IP_WINDOW_MS,
        EMAIL_SHORT_WINDOW_MS,
        EMAIL_LONG_WINDOW_MS,
      );

      /**
       * IP: 만료 1개 제거, 유효 1개 유지
       */
      expect(ipStore.size).toBe(1);
      expect(ipStore.has("10.5.0.2")).toBe(true);

      /**
       * Email: 완전 만료 1개 제거, 부분 만료 1개 정리, 유효 1개 유지
       */
      expect(emailStore.size).toBe(2);
      expect(emailStore.has("exp1@example.com")).toBe(false);
      expect(emailStore.has("exp2@example.com")).toBe(true);
      expect(emailStore.get("exp2@example.com")?.shortWindow).toBeNull();
      expect(emailStore.has("valid@example.com")).toBe(true);
    });
  });
});
