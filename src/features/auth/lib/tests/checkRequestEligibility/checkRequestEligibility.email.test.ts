/**
 * 요청 허용성 시스템 — Email rate limit 검증
 *
 * email short window, email long window, canonical email bucket 동작을 검증한다.
 *
 * 검증 범위:
 * - email short window 연타 억제
 * - email long window 사용자 단위 지속 요청 방어
 * - canonical email은 caller가 정규화해서 전달한다는 책임 경계
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRequestEligibility,
  EMAIL_LONG_LIMIT,
  EMAIL_LONG_WINDOW_MS,
  EMAIL_SHORT_LIMIT,
  EMAIL_SHORT_WINDOW_MS,
  resetEligibilityStore,
} from "@/features/auth/lib/checkRequestEligibility";

beforeEach(() => {
  resetEligibilityStore();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRequestEligibility — Email rate limit", () => {
  describe("email short window (연타 억제)", () => {
    it("TC-05. 동일 email: short 한도 이하 → { allowed: true }", () => {
      const email = "retry@example.com";

      for (let i = 0; i < EMAIL_SHORT_LIMIT; i++) {
        const result = checkRequestEligibility("signup", `10.0.0.${i}`, email);
        expect(result.allowed).toBe(true);
      }
    });

    it("TC-06. 동일 email: short 한도 초과 → { allowed: false }", () => {
      const email = "retry@example.com";

      // short 한도 채우기
      for (let i = 0; i < EMAIL_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
      }

      // 다음 요청 차단
      const result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);
    });

    it("TC-07. short window 만료 후 → 허용으로 복구", () => {
      const email = "retry@example.com";

      // 초기 요청 1회 수행 (EMAIL_SHORT_LIMIT=1 이므로 1회로 한도 도달)
      checkRequestEligibility("signup", "10.0.0.0", email);

      // 차단됨 (short window 활성: count=1, limit=1)
      let result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);

      // short window 만료 시점까지 시간 진행
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);

      // 허용됨 (short window 만료, long window count=1 < limit=5)
      // [이유: short window 만료 후 withinLimit=true.
      //  long window는 아직 만료 전이지만 count < limit 이므로 true.]
      result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(true);
    });
  });

  describe("email long window (user-level)", () => {
    it("TC-08. 동일 email: long 한도 이하 → { allowed: true }", () => {
      const email = "longwindow@example.com";

      // EMAIL_LONG_LIMIT만큼 요청하고, 매 요청 사이 short window를 넘겨 시간 진행
      // [이유: EMAIL_SHORT_LIMIT=1 이므로 시간 진행 없이 연속 요청 불가.
      //  long window 동작 검증을 위해 요청 간 short window를 넘긴다.]
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        const result = checkRequestEligibility("signup", `10.0.0.${i}`, email);
        expect(result.allowed).toBe(true);
        // 다음 요청 전 short window를 넘겨 시간 진행
        if (i < EMAIL_LONG_LIMIT - 1) {
          vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
        }
      }
    });

    it("TC-09. 동일 email: long 한도 초과 → { allowed: false }", () => {
      const email = "longwindow@example.com";

      // long 한도 채우기 (요청 간 short window를 넘겨 시간 진행)
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
        if (i < EMAIL_LONG_LIMIT - 1) {
          vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
        }
      }

      // 다음 요청은 long window 한도 도달로 차단
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      const result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);
    });

    it("TC-10. long window 만료 후 → 허용으로 복구", () => {
      const email = "longwindow@example.com";

      // long 한도 채우기
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
        if (i < EMAIL_LONG_LIMIT - 1) {
          vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
        }
      }

      // long window로 차단
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      let result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);

      // long window 만료 시점까지 시간 진행
      vi.advanceTimersByTime(EMAIL_LONG_WINDOW_MS + 1);

      // 다시 허용 (두 window 모두 초기화)
      result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(true);
    });
  });
});
