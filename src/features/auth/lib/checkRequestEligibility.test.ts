/**
 * 요청 허용성 시스템 — 통합 rate limit 검증
 *
 * IP 제한, 이메일 short window, 이메일 long window의 세 조건을
 * 단일 진입점 결정 함수에서 원자적으로 평가하는지 검증한다.
 *
 * 설계:
 * - 단일 결정 권한: checkRequestEligibility(route, ip, email)
 * - AND 평가: 모든 조건이 통과해야 allowed=true
 * - 원자적 업데이트: allowed=true일 때만 상태 갱신
 * - 상태 오염 방지: 차단된 요청은 어떤 카운터도 증가시키지 않음
 * - 지연 초기화: email store 항목은 allowed=true일 때만 생성
 * - 사용자 스코프: email 상태는 signup/resend 간 공유
 *
 * 관측성:
 * - logRequestEligibilityBlocked는 allowed=false일 때만 호출
 * - 디버깅을 위해 조건(ipOk, emailShortOk, emailLongOk) 로깅
 * - 식별자 마스킹(raw IP/email 로그 금지)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkIpRateLimitPrecheck,
  checkRequestEligibility,
  EMAIL_LONG_LIMIT,
  EMAIL_LONG_WINDOW_MS,
  EMAIL_SHORT_LIMIT,
  EMAIL_SHORT_WINDOW_MS,
  IP_LIMIT,
  IP_WINDOW_MS,
  resetEligibilityStore,
} from "./checkRequestEligibility";
import { ipStore } from "./requestEligibilityStore";

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
  // IP rate limit (단일 윈도우, signup/resend 공유)
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

      // 한도 채우기
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // 11번째 요청 차단
      const result = checkRequestEligibility(
        "signup",
        ip,
        "blocked@example.com",
      );
      expect(result.allowed).toBe(false);
    });

    it("TC-03. IP window 만료 후 → 허용으로 복구", () => {
      const ip = "10.0.0.3";

      // 한도 채우기
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // 차단됨
      let result = checkRequestEligibility("signup", ip, "blocked@example.com");
      expect(result.allowed).toBe(false);

      // window 만료 시점까지 시간 진행
      vi.advanceTimersByTime(IP_WINDOW_MS + 1);

      // 다시 허용
      result = checkRequestEligibility("signup", ip, "recovered@example.com");
      expect(result.allowed).toBe(true);
    });

    it("TC-04. 서로 다른 IP → 독립 동작", () => {
      const ip1 = "10.0.0.4";
      const ip2 = "10.0.0.5";

      // ip1 한도 채우기
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip1, `user${i}@example.com`);
      }

      // ip1 차단
      let result = checkRequestEligibility(
        "signup",
        ip1,
        "blocked@example.com",
      );
      expect(result.allowed).toBe(false);

      // ip2 허용(독립 동작)
      result = checkRequestEligibility("signup", ip2, "user@example.com");
      expect(result.allowed).toBe(true);
    });
  });

  // ============================================================================
  // Email short window (즉시 재시도 억제, cooldown 대체)
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

  // ============================================================================
  // Email long window (사용자 단위 계정 rate limit)
  // ============================================================================

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

  // ============================================================================
  // AND 평가 — 동시 조건 확인
  // ============================================================================

  describe("AND 조건 — 동시 평가", () => {
    it("TC-11. IP 초과 → email 조건 무관하게 { allowed: false }", () => {
      const ip = "10.0.1.1";

      // IP 한도 채우기
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // IP 차단 상태, email 조건이 새로워도 차단 유지
      const result = checkRequestEligibility("signup", ip, "fresh@example.com");
      expect(result.allowed).toBe(false);
    });

    it("TC-12. email short 초과 → IP/long 조건 무관하게 { allowed: false }", () => {
      const email = "retry@example.com";

      // short 한도 채우기
      for (let i = 0; i < EMAIL_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
      }

      // short 차단 상태, IP/long이 새로워도 차단 유지
      const result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);
    });

    it("TC-13. email long 초과 → IP/short 조건 무관하게 { allowed: false }", () => {
      const email = "longblock@example.com";

      // long 한도 채우기 (short window 영향을 배제하기 위해 요청 간 간격 확보)
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
        if (i < EMAIL_LONG_LIMIT - 1) {
          vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
        }
      }

      // short window를 명시적으로 만료시켜 long 조건만으로 차단되는지 검증
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);

      // long 차단 상태, IP/short가 새로워도 차단 유지
      const result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);
    });

    it("TC-14. 차단 시 → 세 카운터 모두 증가하지 않음", () => {
      const ip = "10.0.2.1";
      const email = "test@example.com";

      // IP 한도: 10회 허용 후 차단
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // 차단 요청은 어떤 카운터도 증가시키지 않아야 함
      const blockedResult = checkRequestEligibility("signup", ip, email);
      expect(blockedResult.allowed).toBe(false);

      // IP window 만료 후 재시도로 검증
      // 차단 요청에서 카운터가 증가했다면 다음 요청도 차단되어야 하지만,
      // 차단 요청은 증가하지 않으므로 만료 후에는 다시 허용되어야 함
      vi.advanceTimersByTime(IP_WINDOW_MS + 1);

      const recoveredResult = checkRequestEligibility("signup", ip, email);
      expect(recoveredResult.allowed).toBe(true);
    });
  });

  // ============================================================================
  // 원자적 상태 갱신
  // ============================================================================

  describe("atomic 상태 갱신", () => {
    it("TC-15. 허용 시 → 세 카운터(IP, short, long) 동시 증가", () => {
      const ip = "10.0.15.1";
      const email = "atomic@example.com";

      const result = checkRequestEligibility("signup", ip, email);
      expect(result.allowed).toBe(true);

      // IP 카운터 증가 확인
      // 동일 email long window 제한을 피하기 위해 email을 바꿔 호출
      for (let i = 1; i < IP_LIMIT; i++) {
        const r = checkRequestEligibility(
          "signup",
          ip,
          `ip-test${i}@example.com`,
        );
        expect(r.allowed).toBe(true);
      }

      // 다음 IP 요청은 차단
      const ipBlocked = checkRequestEligibility(
        "signup",
        ip,
        "blocked@example.com",
      );
      expect(ipBlocked.allowed).toBe(false);

      // 새 email + 다른 IP로 email 카운터 검증
      const email2 = "atomic2@example.com";

      // 1회 요청으로 short 한도(=1) 채우기
      const r = checkRequestEligibility("signup", "10.0.15.100", email2);
      expect(r.allowed).toBe(true);

      // 다음 요청은 short window로 차단 (count=1, limit=1)
      const shortBlocked = checkRequestEligibility(
        "signup",
        "10.0.15.101",
        email2,
      );
      expect(shortBlocked.allowed).toBe(false);

      // short 카운터 초기화를 위해 short window 넘겨 시간 진행
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);

      // short window 만료(초기화), long window count=1 < limit=5 유지
      // 다음 요청은 short/long 모두 통과
      // [이유: short는 만료 시 초기화되고 long count=1 < 5]
      const afterShortReset = checkRequestEligibility(
        "signup",
        "10.0.15.101",
        email2,
      );
      expect(afterShortReset.allowed).toBe(true);
    });

    it("TC-16. 차단 시 → 어느 카운터도 증가하지 않음", () => {
      const ip = "10.0.4.1";

      // IP 한도 채우기
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // 이후 5회 요청은 IP로 차단
      for (let i = 0; i < 5; i++) {
        const result = checkRequestEligibility(
          "signup",
          ip,
          `blocked${i}@example.com`,
        );
        expect(result.allowed).toBe(false);
      }

      // IP window 만료 시점까지 시간 진행
      vi.advanceTimersByTime(IP_WINDOW_MS + 1);

      // 다시 허용 — 차단 구간에서는 IP 카운터가 증가하지 않음
      const recovered = checkRequestEligibility(
        "signup",
        ip,
        "recovered@example.com",
      );
      expect(recovered.allowed).toBe(true);
    });
  });

  // ============================================================================
  // 사용자 스코프 상태 — signup/resend email store 공유
  // ============================================================================

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

  // ============================================================================
  // Store 초기화 기능
  // ============================================================================

  describe("resetEligibilityStore", () => {
    it("TC-19. 초기화 후 → 모든 조건 통과", () => {
      const ip = "10.0.5.1";
      const email = "reset@example.com";

      // 한도 채우기
      for (let i = 0; i < IP_LIMIT; i++) {
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

  // ============================================================================
  // Window 경계 동작 (명시적 시간 경계 테스트)
  // ============================================================================

  describe("window 경계값 — 정확한 만료 시점 동작 고정", () => {
    it("TC-20. IP window: now - windowStart === windowMs 일 때 → { allowed: true }", () => {
      const ip = "10.0.6.1";

      // t=0에서 첫 요청
      checkRequestEligibility("signup", ip, "user0@example.com");

      // 정확히 windowMs(경계)까지 시간 진행
      vi.advanceTimersByTime(IP_WINDOW_MS);

      // 경계에서는 window 만료로 간주되어 새 window 시작
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

  // ============================================================================
  // 이메일 canonicalization (caller 책임)
  // ============================================================================

  describe("email canonicalization은 caller 책임", () => {
    it("TC-23. caller가 canonical email을 전달 → 동일 canonical은 동일 bucket", () => {
      // caller(signup/resend)에서 canonicalizeEmail()로 정규화 후 전달
      // 이 테스트는 정규화된 이메일이 동일 bucket을 공유하는지 검증
      const canonicalEmail = "test@example.com"; // caller가 사전 정규화

      // long 한도 소모 (요청 간 short window를 넘겨 시간 진행)
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, canonicalEmail);
        if (i < EMAIL_LONG_LIMIT - 1) {
          vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
        }
      }

      // 같은 canonical로 다음 요청 시에도 차단되어야 함 (long 한도 도달)
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      const result = checkRequestEligibility(
        "signup",
        "10.0.0.99",
        canonicalEmail,
      );
      expect(result.allowed).toBe(false); // 동일 canonical → 동일 bucket
    });
  });

  // ============================================================================
  // 복합 상태 시나리오
  // ============================================================================

  describe("복합 상태 — 내부 차단 원인이 달라도 외부 observable은 동일", () => {
    it("TC-24. short window 복구 + long window 차단 → { allowed: false }", () => {
      const email = "complex@example.com";

      // long 한도 채우기 (요청 간 short window를 넘겨 시간 진행)
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
        if (i < EMAIL_LONG_LIMIT - 1) {
          vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
        }
      }

      // long window로 차단됨 (short 아님)
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);
      let result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);

      // short window를 넘어도 효과 없음 (long 활성 유지)
      vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1);

      // 여전히 차단됨 (long window 미만료)
      // [이유: EMAIL_LONG_WINDOW_MS=900초, EMAIL_SHORT_WINDOW_MS=30초.
      //  short만 넘긴 60초로는 long(900초)이 만료되지 않는다.]
      result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);
    });

    it("TC-25. IP만 차단된 상태 → { allowed: false }", () => {
      const ip = "10.0.7.1";
      const email = "ip-blocked@example.com";

      // IP 한도 채우기
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // IP만 차단, 나머지 조건 통과여도 전체 차단
      const result = checkRequestEligibility("signup", ip, email);
      expect(result.allowed).toBe(false);
    });

    it("TC-26. email short만 차단된 상태 → { allowed: false }", () => {
      const email = "short-blocked@example.com";

      // short 한도 채우기
      for (let i = 0; i < EMAIL_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.0.${i}`, email);
      }

      // short만 차단, IP/long 통과여도 전체 차단
      const result = checkRequestEligibility("signup", "10.0.0.99", email);
      expect(result.allowed).toBe(false);
    });
  });

  // ============================================================================
  // 동시성 근사 — 같은 시점 연속 호출
  // ============================================================================

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

  // ============================================================================
  // 복구 흐름 — 시간 경과 기반 자연 복구
  // ============================================================================

  describe("복구 흐름 — 차단 → window 만료 → 재시도 성공", () => {
    it("TC-27. IP window 만료 후 동일 IP로 재시도 → { allowed: true }", () => {
      const ip = "10.0.8.1";

      // 한도 채우고 차단 확인
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }
      let result = checkRequestEligibility("signup", ip, "blocked@example.com");
      expect(result.allowed).toBe(false);

      // 복구
      vi.advanceTimersByTime(IP_WINDOW_MS + 1);
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

  // ============================================================================
  // 관측성 — 차단 요청 로깅
  // ============================================================================

  describe("관측성 — logRequestEligibilityBlocked 호출 검증", () => {
    it("TC-L1. checkRequestEligibility('signup', ...) 차단 시 → route:'signup'으로 로그됨", () => {
      // 로깅 출력 캡처를 위한 console.log 스파이 설정
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const ip = "10.0.9.1";

      // IP 한도 채우기
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // 차단 요청은 로그가 남아야 함
      checkRequestEligibility("signup", ip, "blocked@example.com");

      // signup route로 로그 호출되었는지 검증
      expect(consoleSpy).toHaveBeenCalled();
      const lastCall =
        consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1]?.[0];
      expect(lastCall).toContain('"route":"signup"');

      consoleSpy.mockRestore();
    });

    it("TC-L2. checkRequestEligibility('resend', ...) 차단 시 → route:'resend'으로 로그됨", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const email = "test@example.com";

      // long 한도 채우기
      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("resend", `10.0.0.${i}`, email);
      }

      // 차단 요청은 로그가 남아야 함
      checkRequestEligibility("resend", "10.0.0.99", email);

      // resend route로 로그 호출되었는지 검증
      expect(consoleSpy).toHaveBeenCalled();
      const lastCall =
        consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1]?.[0];
      expect(lastCall).toContain('"route":"resend"');

      consoleSpy.mockRestore();
    });

    it("TC-L3. 허용 시 → logRequestEligibilityBlocked 미호출", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // 허용 요청은 로깅을 유발하지 않아야 함
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

      // IP 차단 시나리오
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

      // IP 한도 채우기
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // 차단 요청
      checkRequestEligibility("signup", ip, email);

      const lastCall =
        consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1]?.[0];

      // raw IP가 로그에 없어야 함
      expect(lastCall).not.toContain(ip);

      // 마스킹된 IP는 로그에 있어야 함
      expect(lastCall).toContain("10.0.11.***");

      // raw email이 로그에 없어야 함
      expect(lastCall).not.toContain(email);

      // 마스킹된 email은 로그에 있어야 함
      expect(lastCall).toContain("***@example.com");

      consoleSpy.mockRestore();
    });
  });

  describe("checkIpRateLimitPrecheck — 읽기 전용 IP 사전 검증", () => {
    it("TC-P1. IP 한도 이하 → { allowed: true }", () => {
      const ip = "10.200.0.1";
      const precheck = checkIpRateLimitPrecheck(ip);
      expect(precheck.allowed).toBe(true);
    });

    it("TC-P2. IP 한도 초과 → { allowed: false }", () => {
      const ip = "10.200.1.1";

      /**
       * IP 한도 채우기
       */
      for (let i = 0; i < IP_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      /**
       * 사전검증(precheck)에서 차단되어야 함
       */
      const precheck = checkIpRateLimitPrecheck(ip);
      expect(precheck.allowed).toBe(false);
    });

    it("TC-P2A. 경계값(timestamp === now - window)은 유효로 포함되어 평가된다", () => {
      const ip = "10.200.1.2";
      const now = Date.now();
      const boundaryTs = now - IP_WINDOW_MS;

      (ipStore as unknown as Map<string, { timestamps: number[] }>).set(ip, {
        timestamps: Array.from({ length: IP_LIMIT }, () => boundaryTs),
      });

      const precheck = checkIpRateLimitPrecheck(ip);
      expect(precheck.allowed).toBe(false);
    });

    it("TC-P3. 호출 후 ipStore 상태 변경 없음 (읽기 전용)", () => {
      const ip = "10.200.2.1";

      /**
       * 초기 상태: IP 항목 없음
       */
      let precheck = checkIpRateLimitPrecheck(ip);
      expect(precheck.allowed).toBe(true);

      /**
       * 첫 번째 체크 후: 여전히 ipStore에 항목 없음 (precheck은 상태 변경 안 함)
       */
      let ipEntry = (
        ipStore as unknown as Map<string, { timestamps: number[] }>
      ).get(ip);
      expect(ipEntry).toBeUndefined();

      /**
       * checkRequestEligibility를 통해 상태를 생성해야 ipStore에 항목이 생김
       */
      checkRequestEligibility("signup", ip, "user@example.com");
      ipEntry = (
        ipStore as unknown as Map<string, { timestamps: number[] }>
      ).get(ip);
      expect(ipEntry).toBeDefined();
      expect(ipEntry?.timestamps.length).toBe(1);

      /**
       * 사전검증(precheck) 호출 후 상태가 변경되지 않음
       */
      precheck = checkIpRateLimitPrecheck(ip);
      expect(precheck.allowed).toBe(true); // 아직 한도 이하
      ipEntry = (
        ipStore as unknown as Map<string, { timestamps: number[] }>
      ).get(ip);
      expect(ipEntry?.timestamps.length).toBe(1); // timestamps 길이가 변경되지 않음
    });
  });
});
