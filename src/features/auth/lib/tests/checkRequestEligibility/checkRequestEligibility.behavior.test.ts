/**
 * checkRequestEligibility — behavior / state boundary 테스트
 *
 * 검증 범위:
 * - signup/resend 간 user-level email state 공유
 * - resetEligibilityStore 초기화
 * - window 경계값 동작
 * - 같은 시점 연속 호출에 대한 동시성 근사
 * - 차단 후 window 만료에 따른 복구 흐름
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRequestEligibility,
  EMAIL_LONG_LIMIT,
  EMAIL_LONG_WINDOW_MS,
  EMAIL_SHORT_WINDOW_MS,
  IP_SHORT_LIMIT,
  IP_SHORT_WINDOW_MS,
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

describe("checkRequestEligibility — behavior / state boundary", () => {
  describe("user-level state — signup/resend 공유", () => {
    it("TC-17. email long 카운터를 signup/resend가 공유", () => {
      const email = "shared@example.com";

      // signup으로 long 한도 일부 소모 (EMAIL_LONG_LIMIT-1회, resend에 1회 남김)
      // [이유: signup/resend가 공유 quota를 함께 소모하는지 검증]
      for (let i = 0; i < EMAIL_LONG_LIMIT - 1; i++) {
        const result = checkRequestEligibility("signup", `10.0.0.${i}`, email);
        expect(result.allowed).toBe(true);
        vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      }

      // 남은 quota를 resend로 소모
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      let result = checkRequestEligibility(
        "resend",
        `10.0.0.${EMAIL_LONG_LIMIT - 1}`,
        email,
      );
      expect(result.allowed).toBe(true);

      // 다음 signup은 quota 소진으로 차단
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);

      // resend도 차단되어야 함 (long 카운터 공유)
      result = checkRequestEligibility("resend", "10.0.0.99", email);
      expect(result.allowed).toBe(false);

      // long window 복구
      vi.advanceTimersByTime(EMAIL_LONG_WINDOW_MS + 1);

      // signup/resend 모두 다시 허용
      result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(true);
    });

    it("TC-18. 같은 email + 같은 시간 → 두 호출이 동일한 결과", () => {
      const email = "consistency@example.com";

      // signup으로 첫 호출
      const signupResult = checkRequestEligibility("signup", "10.0.0.1", email);
      expect(signupResult.allowed).toBe(true);

      // 공정 비교를 위해 short window를 넘겨 초기화
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);

      // resend로 두 번째 호출 — 동일하게 허용되어야 함(같은 email/store 사용)
      // [이유: short 만료 후 같은 email이면 signup/resend는 동일 동작이어야 함.
      //  공유 emailStore가 사용자 스코프 동작을 보장한다.]
      const resendResult = checkRequestEligibility("resend", "10.0.0.2", email);
      expect(resendResult.allowed).toBe(true);
      expect(signupResult.allowed).toBe(resendResult.allowed);
    });
  });

  describe("resetEligibilityStore", () => {
    it("TC-19. 초기화 후 → 모든 조건 통과", () => {
      const ip = "10.0.5.1";
      const email = "reset@example.com";

      // IP short 한도 채우기 (IP_SHORT_LIMIT으로 rename됨)
      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // 차단됨
      let result = checkRequestEligibility("signup", ip, email);
      expect(result.allowed).toBe(false);

      // 초기화
      resetEligibilityStore();

      // 모든 조건 통과
      result = checkRequestEligibility("signup", ip, email);
      expect(result.allowed).toBe(true);
    });
  });

  describe("window 경계값 — 정확한 만료 시점 동작 고정", () => {
    it("TC-20. IP short window: now - windowStart === windowMs 일 때 → { allowed: true }", () => {
      const ip = "10.0.6.1";

      // t=0에서 첫 요청
      checkRequestEligibility("signup", ip, "user0@example.com");

      // 정확히 IP_SHORT_WINDOW_MS(경계)까지 시간 진행
      // [이유: IP_WINDOW_MS → IP_SHORT_WINDOW_MS로 rename됨]
      vi.advanceTimersByTime(IP_SHORT_WINDOW_MS);

      // 경계에서는 short window 만료로 간주되어 새 window 시작
      const result = checkRequestEligibility("signup", ip, "user1@example.com");
      expect(result.allowed).toBe(true);
    });

    it("TC-21. email short window: now - windowStart === windowMs 일 때 → { allowed: false }", () => {
      const email = "shortboundary@example.com";

      // t=0에서 첫 요청
      checkRequestEligibility("signup", "10.0.0.1", email);

      // 정확히 EMAIL_SHORT_WINDOW_MS(경계)까지 시간 진행
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS);

      // 슬라이딩 윈도우 규칙(timestamp >= window_start)에서 경계값은 유효 구간에 포함됨
      // 첫 요청 timestamp가 경계에 포함되므로 short limit(1) 기준으로 차단되어야 한다.
      const result = checkRequestEligibility("signup", "10.0.0.2", email);
      expect(result.allowed).toBe(false);
    });

    it("TC-22. email long window: now - windowStart === windowMs 일 때 → { allowed: true }", () => {
      const email = "longboundary@example.com";

      // t=0에서 첫 요청
      checkRequestEligibility("signup", "10.0.0.1", email);

      // 정확히 EMAIL_LONG_WINDOW_MS(경계)까지 시간 진행
      vi.advanceTimersByTime(EMAIL_LONG_WINDOW_MS);

      // 경계에서는 long window 만료로 간주되어 새 window 시작
      const result = checkRequestEligibility("signup", "10.0.0.2", email);
      expect(result.allowed).toBe(true);
    });
  });

  describe("동시성 근사 — 같은 시점 연속 호출", () => {
    it("TC-26A. 같은 email로 연속 2회 요청 시 한 번만 허용된다 (short window)", () => {
      const email = "near-concurrent@example.com";

      // 같은 timestamp(타이머 진행 없음), 다른 IP
      const first = checkRequestEligibility("signup", "10.30.0.1", email);
      const second = checkRequestEligibility("signup", "10.30.0.2", email);

      expect(first.allowed).toBe(true);
      expect(second.allowed).toBe(false);

      // short window 만료 후에는 다시 허용되어야 함
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      const third = checkRequestEligibility("signup", "10.30.0.3", email);
      expect(third.allowed).toBe(true);
    });
  });

  describe("복구 흐름 — 차단 → window 만료 → 재시도 성공", () => {
    it("TC-27. IP short window 만료 후 동일 IP로 재시도 → { allowed: true }", () => {
      // [이유: IP_LIMIT → IP_SHORT_LIMIT, IP_WINDOW_MS → IP_SHORT_WINDOW_MS로 rename됨]
      const ip = "10.0.8.1";

      // IP short 한도 채우고 차단 확인
      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }
      let result = checkRequestEligibility("signup", ip, "blocked@example.com");
      expect(result.allowed).toBe(false);

      // IP short window 복구
      vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);
      result = checkRequestEligibility("signup", ip, "recovered@example.com");
      expect(result.allowed).toBe(true);
    });

    it("TC-28. email short window 만료 후 동일 email로 재시도 → { allowed: true }", () => {
      const email = "short-recover@example.com";

      // 1회 요청으로 short window 채우기 (EMAIL_SHORT_LIMIT=1)
      checkRequestEligibility("signup", "10.0.0.0", email);
      let result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);

      // short window 만료 시점까지 시간 진행
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);

      // 다시 허용됨 (short 만료, long count=1 < 5)
      // [이유: short는 만료 시 초기화되고 long count=1 < limit=5라
      //  두 조건이 모두 true가 된다.]
      result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(true);
    });
  });
});
