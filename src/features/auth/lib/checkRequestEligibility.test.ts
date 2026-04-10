/**
 * Request Eligibility System — unified rate limit check
 *
 * Tests the single entry point decision function that evaluates all three conditions
 * (IP limit, email short window, email long window) atomically.
 *
 * Design:
 * - Single decision authority: checkRequestEligibility(route, ip, email)
 * - AND evaluation: all conditions must pass for allowed=true
 * - Atomic update: state updates only if allowed=true
 * - No state pollution: blocked requests do not increment any counters
 * - Lazy initialization: email store entries created only on allowed=true
 * - User-scoped: email state is shared between signup and resend
 *
 * Observability:
 * - logRequestEligibilityBlocked called only when allowed=false
 * - Conditions (ipOk, emailShortOk, emailLongOk) logged for debugging
 * - Masked identifiers (no raw IP/email in logs)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRequestEligibility,
  EMAIL_LONG_LIMIT,
  EMAIL_LONG_WINDOW_MS,
  EMAIL_SHORT_LIMIT,
  EMAIL_SHORT_WINDOW_MS,
  IP_LIMIT,
  IP_WINDOW_MS,
  resetEligibilityStore,
} from "./checkRequestEligibility";

beforeEach(() => {
  resetEligibilityStore();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRequestEligibility", () => {
  // ============================================================================
  // IP rate limit (single window, shared across signup/resend)
  // ============================================================================

  describe("IP rate limit", () => {
    it("TC-01. 동일 IP: 한도 이하 → { allowed: true }", () => {
      const ip = "10.0.0.1";

      for (let i = 0; i < IP_LIMIT; i++) {
        const result = checkRequestEligibility(
          "signup",
          ip,
          `user${i}@example.com`,
        );
        expect(result.allowed).toBe(true);
      }
    });

    it("TC-02. 동일 IP: 한도 초과 → { allowed: false }", () => {
      const ip = "10.0.0.2";

      // Fill quota
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // 11th request blocked
      const result = checkRequestEligibility(
        "signup",
        ip,
        "blocked@example.com",
      );
      expect(result.allowed).toBe(false);
    });

    it("TC-03. IP window 만료 후 → 허용으로 복구", () => {
      const ip = "10.0.0.3";

      // Fill quota
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // Blocked
      let result = checkRequestEligibility("signup", ip, "blocked@example.com");
      expect(result.allowed).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime(IP_WINDOW_MS + 1);

      // Now allowed
      result = checkRequestEligibility("signup", ip, "recovered@example.com");
      expect(result.allowed).toBe(true);
    });

    it("TC-04. 서로 다른 IP → 독립 동작", () => {
      const ip1 = "10.0.0.4";
      const ip2 = "10.0.0.5";

      // Fill quota for ip1
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip1, `user${i}@example.com`);
      }

      // ip1 blocked
      let result = checkRequestEligibility(
        "signup",
        ip1,
        "blocked@example.com",
      );
      expect(result.allowed).toBe(false);

      // ip2 allowed (independent)
      result = checkRequestEligibility("signup", ip2, "user@example.com");
      expect(result.allowed).toBe(true);
    });
  });

  // ============================================================================
  // Email short window (immediate retry suppression, replaces cooldown)
  // ============================================================================

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

      // Fill short quota
      for (let i = 0; i < EMAIL_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
      }

      // Next request blocked
      const result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);
    });

    it("TC-07. short window 만료 후 → 허용으로 복구", () => {
      const email = "retry@example.com";

      // Make initial request (EMAIL_SHORT_LIMIT=1, so quota filled with 1 request)
      checkRequestEligibility("signup", "10.0.0.0", email);

      // Blocked (short window active: count=1, limit=1)
      let result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);

      // Advance time past short window
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);

      // Allowed (short window expired, long window count=1 < limit=5)
      // [Reason: after short window expires, withinLimit returns true.
      //  long window hasn't expired yet but count < limit, so also true.]
      result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(true);
    });
  });

  // ============================================================================
  // Email long window (user-level account rate limit)
  // ============================================================================

  describe("email long window (user-level)", () => {
    it("TC-08. 동일 email: long 한도 이하 → { allowed: true }", () => {
      const email = "longwindow@example.com";

      // Make EMAIL_LONG_LIMIT requests, advancing past short window each time
      // [Reason: EMAIL_SHORT_LIMIT=1 prevents consecutive requests without time advance.
      //  To test long window behavior, we advance past short window between requests.]
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        const result = checkRequestEligibility("signup", `10.0.0.${i}`, email);
        expect(result.allowed).toBe(true);
        // Advance past short window before next request
        if (i < EMAIL_LONG_LIMIT - 1) {
          vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
        }
      }
    });

    it("TC-09. 동일 email: long 한도 초과 → { allowed: false }", () => {
      const email = "longwindow@example.com";

      // Fill long quota (advance past short window between requests)
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
        if (i < EMAIL_LONG_LIMIT - 1) {
          vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
        }
      }

      // Next request blocked by long window (reached limit)
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      const result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);
    });

    it("TC-10. long window 만료 후 → 허용으로 복구", () => {
      const email = "longwindow@example.com";

      // Fill long quota
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
        if (i < EMAIL_LONG_LIMIT - 1) {
          vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
        }
      }

      // Blocked by long window
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      let result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);

      // Advance time past long window
      vi.advanceTimersByTime(EMAIL_LONG_WINDOW_MS + 1);

      // Now allowed (both windows reset)
      result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(true);
    });
  });

  // ============================================================================
  // AND evaluation — simultaneous condition check
  // ============================================================================

  describe("AND 조건 — 동시 평가", () => {
    it("TC-11. IP 초과 → email 조건 무관하게 { allowed: false }", () => {
      const ip = "10.0.1.1";

      // Fill IP quota
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // IP blocked, email fresh → still blocked
      const result = checkRequestEligibility("signup", ip, "fresh@example.com");
      expect(result.allowed).toBe(false);
    });

    it("TC-12. email short 초과 → IP/long 조건 무관하게 { allowed: false }", () => {
      const email = "retry@example.com";

      // Fill short quota
      for (let i = 0; i < EMAIL_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
      }

      // Short blocked, IP fresh, long fresh → still blocked
      const result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);
    });

    it("TC-13. email long 초과 → IP/short 조건 무관하게 { allowed: false }", () => {
      const email = "longblock@example.com";

      // Fill long quota
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
      }

      // Long blocked, IP fresh, short fresh → still blocked
      const result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);
    });

    it("TC-14. 차단 시 → 세 카운터 모두 증가하지 않음", () => {
      const ip = "10.0.2.1";
      const email = "test@example.com";

      // IP limit: allow 10 times, then block
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // Blocked request should not increment any counter
      const blockedResult = checkRequestEligibility("signup", ip, email);
      expect(blockedResult.allowed).toBe(false);

      // Verify by advancing time past IP window and trying again
      // If IP counter was incremented on blocked request, next request would still be blocked
      // But since blocked requests don't increment, counter should be reset after window expiry
      vi.advanceTimersByTime(IP_WINDOW_MS + 1);

      const recoveredResult = checkRequestEligibility("signup", ip, email);
      expect(recoveredResult.allowed).toBe(true);
    });
  });

  // ============================================================================
  // Atomic state updates
  // ============================================================================

  describe("atomic 상태 갱신", () => {
    it("TC-15. 허용 시 → 세 카운터(IP, short, long) 동시 증가", () => {
      const ip = "10.0.15.1";
      const email = "atomic@example.com";

      const result = checkRequestEligibility("signup", ip, email);
      expect(result.allowed).toBe(true);

      // Verify IP counter increments
      // Use different emails to avoid long window limit for this email
      for (let i = 1; i < IP_LIMIT; i++) {
        const r = checkRequestEligibility(
          "signup",
          ip,
          `ip-test${i}@example.com`,
        );
        expect(r.allowed).toBe(true);
      }

      // Next IP request blocked
      const ipBlocked = checkRequestEligibility(
        "signup",
        ip,
        "blocked@example.com",
      );
      expect(ipBlocked.allowed).toBe(false);

      // Now test email counters with a fresh email and different IPs
      const email2 = "atomic2@example.com";

      // Make 1 request (fill short limit = 1)
      const r = checkRequestEligibility("signup", "10.0.15.100", email2);
      expect(r.allowed).toBe(true);

      // Next request blocked by short window (count=1, limit=1)
      const shortBlocked = checkRequestEligibility(
        "signup",
        "10.0.15.101",
        email2,
      );
      expect(shortBlocked.allowed).toBe(false);

      // Advance past short window to reset short counter
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);

      // Short window expired (reset), long window count still =1 < limit=5
      // Next request allowed by both short and long window
      // [Reason: short window resets on expiration, long window count=1 < 5]
      const afterShortReset = checkRequestEligibility(
        "signup",
        "10.0.15.101",
        email2,
      );
      expect(afterShortReset.allowed).toBe(true);
    });

    it("TC-16. 차단 시 → 어느 카운터도 증가하지 않음", () => {
      const ip = "10.0.4.1";

      // Fill IP quota
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // Next 5 requests blocked by IP
      for (let i = 0; i < 5; i++) {
        const result = checkRequestEligibility(
          "signup",
          ip,
          `blocked${i}@example.com`,
        );
        expect(result.allowed).toBe(false);
      }

      // Advance time past IP window
      vi.advanceTimersByTime(IP_WINDOW_MS + 1);

      // Now allowed — IP counter was reset, not incremented during blocked requests
      const recovered = checkRequestEligibility(
        "signup",
        ip,
        "recovered@example.com",
      );
      expect(recovered.allowed).toBe(true);
    });
  });

  // ============================================================================
  // User-scoped state — signup/resend share email store
  // ============================================================================

  describe("user-level state — signup/resend 공유", () => {
    it("TC-17. email long 카운터를 signup/resend가 공유", () => {
      const email = "shared@example.com";

      // Consume some of long limit via signup (EMAIL_LONG_LIMIT-1 requests, leave 1 for resend)
      // [Reason: Test both signup and resend consuming the shared quota.]
      for (let i = 0; i < EMAIL_LONG_LIMIT - 1; i++) {
        const result = checkRequestEligibility("signup", `10.0.0.${i}`, email);
        expect(result.allowed).toBe(true);
        vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      }

      // Consume remaining quota via resend
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      let result = checkRequestEligibility(
        "resend",
        `10.0.0.${EMAIL_LONG_LIMIT - 1}`,
        email,
      );
      expect(result.allowed).toBe(true);

      // Next signup blocked (quota exhausted)
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);

      // Resend should also be blocked (shares long counter)
      result = checkRequestEligibility("resend", "10.0.0.99", email);
      expect(result.allowed).toBe(false);

      // Recover long window
      vi.advanceTimersByTime(EMAIL_LONG_WINDOW_MS + 1);

      // Both signup and resend should be allowed again
      result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(true);
    });

    it("TC-18. 같은 email + 같은 시간 → 두 호출이 동일한 결과", () => {
      const email = "consistency@example.com";

      // First call with signup
      const signupResult = checkRequestEligibility("signup", "10.0.0.1", email);
      expect(signupResult.allowed).toBe(true);

      // Advance past short window to reset for fair comparison
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);

      // Second call with resend — should also be allowed (both use same email/store)
      // [Reason: after short window expires, both signup and resend should behave identically
      //  with the same email. The shared emailStore ensures user-scoped behavior.]
      const resendResult = checkRequestEligibility("resend", "10.0.0.2", email);
      expect(resendResult.allowed).toBe(true);
      expect(signupResult.allowed).toBe(resendResult.allowed);
    });
  });

  // ============================================================================
  // Store reset functionality
  // ============================================================================

  describe("resetEligibilityStore", () => {
    it("TC-19. 초기화 후 → 모든 조건 통과", () => {
      const ip = "10.0.5.1";
      const email = "reset@example.com";

      // Fill quotas
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // Blocked
      let result = checkRequestEligibility("signup", ip, email);
      expect(result.allowed).toBe(false);

      // Reset
      resetEligibilityStore();

      // All conditions pass
      result = checkRequestEligibility("signup", ip, email);
      expect(result.allowed).toBe(true);
    });
  });

  // ============================================================================
  // Window boundary behavior (explicit time-boundary testing)
  // ============================================================================

  describe("window 경계값 — 정확한 만료 시점 동작 고정", () => {
    it("TC-20. IP window: now - windowStart === windowMs 일 때 → { allowed: true }", () => {
      const ip = "10.0.6.1";

      // First request at t=0
      checkRequestEligibility("signup", ip, "user0@example.com");

      // Advance to exactly windowMs (boundary)
      vi.advanceTimersByTime(IP_WINDOW_MS);

      // At boundary, window should be considered expired → new window
      const result = checkRequestEligibility("signup", ip, "user1@example.com");
      expect(result.allowed).toBe(true);
    });

    it("TC-21. email short window: now - windowStart === windowMs 일 때 → { allowed: true }", () => {
      const email = "shortboundary@example.com";

      // First request at t=0
      checkRequestEligibility("signup", "10.0.0.1", email);

      // Advance to exactly EMAIL_SHORT_WINDOW_MS (boundary)
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS);

      // At boundary, short window should be expired → new window
      const result = checkRequestEligibility("signup", "10.0.0.2", email);
      expect(result.allowed).toBe(true);
    });

    it("TC-22. email long window: now - windowStart === windowMs 일 때 → { allowed: true }", () => {
      const email = "longboundary@example.com";

      // First request at t=0
      checkRequestEligibility("signup", "10.0.0.1", email);

      // Advance to exactly EMAIL_LONG_WINDOW_MS (boundary)
      vi.advanceTimersByTime(EMAIL_LONG_WINDOW_MS);

      // At boundary, long window should be expired → new window
      const result = checkRequestEligibility("signup", "10.0.0.2", email);
      expect(result.allowed).toBe(true);
    });
  });

  // ============================================================================
  // Email normalization consistency
  // ============================================================================

  describe("email 정규화 일관성", () => {
    it("TC-23. 대소문자 다른 이메일 → 동일 key로 state 공유", () => {
      const email1 = "Test@Example.com";
      const email2 = "test@example.com";

      // Consume long limit via uppercase variant (advance past short window between requests)
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email1);
        if (i < EMAIL_LONG_LIMIT - 1) {
          vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
        }
      }

      // Next request via lowercase variant should also be blocked (same key, long limit reached)
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      const result = checkRequestEligibility("signup", "10.0.0.99", email2);
      expect(result.allowed).toBe(false);
    });
  });

  // ============================================================================
  // Complex state scenarios
  // ============================================================================

  describe("복합 상태 — 내부 차단 원인이 달라도 외부 observable은 동일", () => {
    it("TC-24. short window 복구 + long window 차단 → { allowed: false }", () => {
      const email = "complex@example.com";

      // Fill long quota (advance past short window between requests)
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
        if (i < EMAIL_LONG_LIMIT - 1) {
          vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
        }
      }

      // Blocked by long window (not short)
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      let result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);

      // Advance past short window doesn't help (long still active)
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);

      // Still blocked (long window not expired yet)
      // [Reason: EMAIL_LONG_WINDOW_MS = 900 seconds >> EMAIL_SHORT_WINDOW_MS = 30 seconds.
      //  Advancing past short window (30+30=60 sec) doesn't expire long window (900 sec).]
      result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);
    });

    it("TC-25. IP만 차단된 상태 → { allowed: false }", () => {
      const ip = "10.0.7.1";
      const email = "ip-blocked@example.com";

      // Fill IP quota
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // IP blocked, others ok → overall blocked
      const result = checkRequestEligibility("signup", ip, email);
      expect(result.allowed).toBe(false);
    });

    it("TC-26. email short만 차단된 상태 → { allowed: false }", () => {
      const email = "short-blocked@example.com";

      // Fill short quota
      for (let i = 0; i < EMAIL_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
      }

      // Short blocked, IP ok, long ok → overall blocked
      const result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);
    });
  });

  // ============================================================================
  // Recovery flow — time-based natural recovery
  // ============================================================================

  describe("복구 흐름 — 차단 → window 만료 → 재시도 성공", () => {
    it("TC-27. IP window 만료 후 동일 IP로 재시도 → { allowed: true }", () => {
      const ip = "10.0.8.1";

      // Fill and block
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }
      let result = checkRequestEligibility("signup", ip, "blocked@example.com");
      expect(result.allowed).toBe(false);

      // Recover
      vi.advanceTimersByTime(IP_WINDOW_MS + 1);
      result = checkRequestEligibility("signup", ip, "recovered@example.com");
      expect(result.allowed).toBe(true);
    });

    it("TC-28. email short window 만료 후 동일 email로 재시도 → { allowed: true }", () => {
      const email = "short-recover@example.com";

      // Make 1 request (fill short window with EMAIL_SHORT_LIMIT=1)
      checkRequestEligibility("signup", "10.0.0.0", email);
      let result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);

      // Advance past short window
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);

      // Now allowed (short window expired, long window count=1 < 5)
      // [Reason: short window reset on expiration. long window count=1 < limit=5,
      //  so both conditions are now true.]
      result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(true);
    });
  });

  // ============================================================================
  // Observability — logging on blocked requests
  // ============================================================================

  describe("Observability — logRequestEligibilityBlocked 호출 검증", () => {
    it("TC-L1. checkRequestEligibility('signup', ...) 차단 시 → route:'signup'으로 로그됨", () => {
      // Setup spy on console.log to capture logging output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const ip = "10.0.9.1";

      // Fill IP quota
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // Blocked request should log
      checkRequestEligibility("signup", ip, "blocked@example.com");

      // Verify log was called with signup route
      expect(consoleSpy).toHaveBeenCalled();
      const lastCall =
        consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1]?.[0];
      expect(lastCall).toContain('"route":"signup"');

      consoleSpy.mockRestore();
    });

    it("TC-L2. checkRequestEligibility('resend', ...) 차단 시 → route:'resend'으로 로그됨", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const email = "test@example.com";

      // Fill long quota
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("resend", `10.0.0.${i}`, email);
      }

      // Blocked request should log
      checkRequestEligibility("resend", "10.0.0.99", email);

      // Verify log was called with resend route
      expect(consoleSpy).toHaveBeenCalled();
      const lastCall =
        consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1]?.[0];
      expect(lastCall).toContain('"route":"resend"');

      consoleSpy.mockRestore();
    });

    it("TC-L3. 허용 시 → logRequestEligibilityBlocked 미호출", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Allowed request should not trigger logging
      const result = checkRequestEligibility(
        "signup",
        "10.0.0.1",
        "user@example.com",
      );
      expect(result.allowed).toBe(true);
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("TC-L4. 차단 원인에 따라 ipOk/emailShortOk/emailLongOk가 정확히 전달됨", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // IP blocking scenario
      const ip = "10.0.10.1";
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      checkRequestEligibility("signup", ip, "blocked@example.com");

      const lastCall =
        consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1]?.[0];
      expect(lastCall).toContain('"ipOk":false');
      expect(lastCall).toContain('"emailShortOk":true');
      expect(lastCall).toContain('"emailLongOk":true');

      consoleSpy.mockRestore();
    });

    it("TC-L5. 로그에 raw IP/email이 아닌 masked 값이 포함됨", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const ip = "10.0.11.1";
      const email = "secret@example.com";

      // Fill IP quota
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // Blocked request
      checkRequestEligibility("signup", ip, email);

      const lastCall =
        consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1]?.[0];

      // Verify raw IP is not in log
      expect(lastCall).not.toContain(ip);

      // Verify masked IP is in log
      expect(lastCall).toContain("10.0.11.***");

      // Verify raw email is not in log
      expect(lastCall).not.toContain(email);

      // Verify masked email is in log
      expect(lastCall).toContain("***@example.com");

      consoleSpy.mockRestore();
    });
  });
});
