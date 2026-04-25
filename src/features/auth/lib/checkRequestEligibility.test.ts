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
  // IP_SHORT_LIMIT과 IP_SHORT_WINDOW_MS로 rename됨 — IP 단일 윈도우를 short/long으로 분리하기 위해
  IP_LONG_LIMIT,
  IP_LONG_WINDOW_MS,
  IP_SHORT_LIMIT,
  IP_SHORT_WINDOW_MS,
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
  // IP rate limit (short window — burst 억제)
  // ============================================================================

  describe("IP rate limit (short window)", () => {
    it("TC-01. 동일 IP: short 한도 이하 → { allowed: true }", () => {
      const ip = "10.0.0.1";

      // IP_SHORT_LIMIT으로 rename됨 — IP 단일 윈도우를 short/long으로 분리하기 위해
      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
        const result = checkRequestEligibility(
          "signup",
          ip,
          `user${i}@example.com`,
        );
        expect(result.allowed).toBe(true);
      }
    });

    it("TC-02. 동일 IP: short 한도 초과 → { allowed: false }", () => {
      const ip = "10.0.0.2";

      // short 한도 채우기 (IP_SHORT_LIMIT으로 rename됨)
      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // 초과 요청 차단
      const result = checkRequestEligibility(
        "signup",
        ip,
        "blocked@example.com",
      );
      expect(result.allowed).toBe(false);
    });

    it("TC-03. IP short window 만료 후 → 허용으로 복구", () => {
      const ip = "10.0.0.3";

      // short 한도 채우기
      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // 차단됨
      let result = checkRequestEligibility("signup", ip, "blocked@example.com");
      expect(result.allowed).toBe(false);

      // IP_SHORT_WINDOW_MS로 rename됨 — short window 만료
      vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);

      // 다시 허용 (long window 미차단 가정)
      result = checkRequestEligibility("signup", ip, "recovered@example.com");
      expect(result.allowed).toBe(true);
    });

    it("TC-04. 서로 다른 IP → 독립 동작", () => {
      const ip1 = "10.0.0.4";
      const ip2 = "10.0.0.5";

      // ip1 short 한도 채우기
      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
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
  // IP rate limit (long window — sustained 공격 방어)
  // ============================================================================

  describe("IP rate limit (long window — sustained 공격 방어)", () => {
    /**
     * IP long window 테스트 전략
     *
     * 제약 조건:
     * - IP_SHORT_WINDOW_MS(60s) > IP_LONG_WINDOW_MS / IP_LONG_LIMIT (900s/50 = 18s)
     *   → 매 요청마다 short window를 넘기면 총 시간이 long window를 초과함
     *
     * 해결:
     * - IP_SHORT_LIMIT(10)개씩 배치로 요청
     * - 배치 간에만 IP_SHORT_WINDOW_MS+1 진행
     * - 배치 수 = ceil(IP_LONG_LIMIT / IP_SHORT_LIMIT) = 5
     * - 총 진행 시간 = 4배치 * 61초 = 244초 < IP_LONG_WINDOW_MS(900초) ✓
     */
    function fillIpLongLimitBatched(ip: string, emailPrefix: string): void {
      // IP_LONG_LIMIT(50)개를 IP_SHORT_LIMIT(10)개씩 배치로 나눠 요청
      // 배치 간에만 IP_SHORT_WINDOW_MS+1 진행하여 long window 안에 누적
      const batchCount = Math.ceil(IP_LONG_LIMIT / IP_SHORT_LIMIT);
      let requestIndex = 0;

      for (let batch = 0; batch < batchCount; batch++) {
        if (batch > 0) {
          // 배치 간 short window 만료 처리
          vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);
        }
        const batchSize = Math.min(
          IP_SHORT_LIMIT,
          IP_LONG_LIMIT - batch * IP_SHORT_LIMIT,
        );
        for (let j = 0; j < batchSize; j++) {
          checkRequestEligibility(
            "signup",
            ip,
            `${emailPrefix}${requestIndex}@example.com`,
          );
          requestIndex++;
        }
      }
    }

    it("TC-L1. IP short 한도 이하이지만 long 한도 초과 → { allowed: false, blockedBy: 'ipLong' }", () => {
      // 설계: IP_SHORT_LIMIT개씩 배치로 요청하여 IP_LONG_WINDOW_MS 이내에 IP_LONG_LIMIT 누적
      //        배치 간 IP_SHORT_WINDOW_MS+1 진행하여 short는 각 배치 시작 시 리셋
      const ip = "10.100.0.1";

      fillIpLongLimitBatched(ip, "tc-l1-user");

      // IP_LONG_LIMIT+1번째 요청: long window 한도 초과 (short 리셋 후)
      vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);
      const result = checkRequestEligibility(
        "signup",
        ip,
        "tc-l1-blocked@example.com",
      );
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        // [이유: short는 초기화되었으므로 long이 차단 원인]
        expect(result.blockedBy).toBe("ipLong");
      }
    });

    it("TC-L2. IP long window 만료 후 → 허용으로 복구", () => {
      const ip = "10.100.0.2";

      fillIpLongLimitBatched(ip, "tc-l2-user");

      // long 한도 초과로 차단됨
      vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);
      let result = checkRequestEligibility(
        "signup",
        ip,
        "tc-l2-blocked@example.com",
      );
      expect(result.allowed).toBe(false);

      // IP_LONG_WINDOW_MS+1 경과 → long window 만료
      vi.advanceTimersByTime(IP_LONG_WINDOW_MS + 1);

      // 복구됨
      result = checkRequestEligibility(
        "signup",
        ip,
        "tc-l2-recovered@example.com",
      );
      expect(result.allowed).toBe(true);
    });

    it("TC-L3. IP short와 long 동시 차단 → blockedBy: 'ipShort' (short 우선)", () => {
      // [이유: 우선순위 — ipShort → ipLong → emailShort → emailLong]
      const ip = "10.100.0.3";

      // long 한도 채우기 (배치 전략 사용)
      fillIpLongLimitBatched(ip, "tc-l3-user");

      // long 차단 상태 + 마지막 배치 이후 short window 이내에 추가 요청 → short도 차단
      // [이유: fillIpLongLimitBatched 후 마지막 배치는 short window 내이므로
      //  short window를 넘기지 않은 상태에서 즉시 요청하면 short와 long 둘 다 차단]
      const result = checkRequestEligibility(
        "signup",
        ip,
        "tc-l3-blocked@example.com",
      );
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        // [이유: short와 long 둘 다 차단 시 short가 우선]
        expect(result.blockedBy).toBe("ipShort");
      }
    });

    it("TC-L4. 차단 시 IP long 카운터 증가하지 않음 (long window 만료 후 재허용으로 검증)", () => {
      const ip = "10.100.0.4";

      // long 한도 채우기
      fillIpLongLimitBatched(ip, "tc-l4-user");

      // 차단 상태에서 여러 번 추가 요청 (차단된 요청은 카운터 증가 금지)
      vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);
      for (let i = 0; i < 5; i++) {
        const blocked = checkRequestEligibility(
          "signup",
          ip,
          `tc-l4-blocked${i}@example.com`,
        );
        expect(blocked.allowed).toBe(false);
        if (i < 4) {
          vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);
        }
      }

      // long window 만료 후 재허용 검증 — 카운터가 증가했다면 여전히 차단되어야 하지만,
      // 차단 요청은 카운터를 증가시키지 않으므로 만료 후 정확히 IP_LONG_LIMIT으로 돌아가야 함
      vi.advanceTimersByTime(IP_LONG_WINDOW_MS + 1);
      const recovered = checkRequestEligibility(
        "signup",
        ip,
        "tc-l4-recovered@example.com",
      );
      expect(recovered.allowed).toBe(true);
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
    it("TC-11. IP short 초과 → email 조건 무관하게 { allowed: false }", () => {
      const ip = "10.0.1.1";

      // IP short 한도 채우기 (IP_SHORT_LIMIT으로 rename됨)
      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // IP short 차단 상태, email 조건이 새로워도 차단 유지
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

      // IP short 한도: IP_SHORT_LIMIT회 허용 후 차단
      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // 차단 요청은 어떤 카운터도 증가시키지 않아야 함
      const blockedResult = checkRequestEligibility("signup", ip, email);
      expect(blockedResult.allowed).toBe(false);

      // IP short window 만료 후 재시도로 검증
      // 차단 요청에서 카운터가 증가했다면 다음 요청도 차단되어야 하지만,
      // 차단 요청은 증가하지 않으므로 만료 후에는 다시 허용되어야 함
      // [이유: IP_SHORT_WINDOW_MS로 rename됨 — short window 만료]
      vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);

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

      // IP short 카운터 증가 확인
      // 동일 email long window 제한을 피하기 위해 email을 바꿔 호출
      // [이유: IP_SHORT_LIMIT으로 rename됨 — short window 기준 확인]
      for (let i = 1; i < IP_SHORT_LIMIT; i++) {
        const r = checkRequestEligibility(
          "signup",
          ip,
          `ip-test${i}@example.com`,
        );
        expect(r.allowed).toBe(true);
      }

      // 다음 IP 요청은 short window로 차단
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

      // IP short 한도 채우기 (IP_SHORT_LIMIT으로 rename됨)
      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // 이후 5회 요청은 IP short로 차단
      for (let i = 0; i < 5; i++) {
        const result = checkRequestEligibility(
          "signup",
          ip,
          `blocked${i}@example.com`,
        );
        expect(result.allowed).toBe(false);
      }

      // IP short window 만료 시점까지 시간 진행 (IP_SHORT_WINDOW_MS로 rename됨)
      vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);

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

  // ============================================================================
  // Window 경계 동작 (명시적 시간 경계 테스트)
  // ============================================================================

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

    it("TC-25. IP short만 차단된 상태 → { allowed: false }", () => {
      const ip = "10.0.7.1";
      const email = "ip-blocked@example.com";

      // IP short 한도 채우기 (IP_SHORT_LIMIT으로 rename됨)
      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      // IP short만 차단, 나머지 조건 통과여도 전체 차단
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

  // ============================================================================
  // blockedBy 반환값 검증 — 차단 차원 식별
  // ============================================================================

  describe("blockedBy 반환값 — 차단 차원 식별", () => {
    it("TC-B1. IP short 차단 시 → { allowed: false, blockedBy: 'ipShort' }", () => {
      // [이유: blockedBy "ip" → "ipShort"로 rename됨 — IP가 short/long으로 분리됨]
      const ip = "10.0.9.1";

      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      const result = checkRequestEligibility(
        "signup",
        ip,
        "blocked@example.com",
      );

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.blockedBy).toBe("ipShort");
      }
    });

    it("TC-B1L. IP long 차단 시 → { allowed: false, blockedBy: 'ipLong' }", () => {
      // [이유: IP long window 추가로 인한 새 차단 차원]
      // [배치 전략: IP_LONG_WINDOW_MS 내에서 IP_SHORT_LIMIT개씩 배치로 IP_LONG_LIMIT 채우기]
      const ip = "10.0.9.2";

      // fillIpLongLimitBatched와 동일한 배치 전략 사용
      const batchCount = Math.ceil(IP_LONG_LIMIT / IP_SHORT_LIMIT);
      let requestIndex = 0;
      for (let batch = 0; batch < batchCount; batch++) {
        if (batch > 0) {
          vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);
        }
        const batchSize = Math.min(
          IP_SHORT_LIMIT,
          IP_LONG_LIMIT - batch * IP_SHORT_LIMIT,
        );
        for (let j = 0; j < batchSize; j++) {
          checkRequestEligibility(
            "signup",
            ip,
            `tc-b1l-user${requestIndex}@example.com`,
          );
          requestIndex++;
        }
      }

      // short 리셋 후 long 한도 초과 요청
      vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);
      const result = checkRequestEligibility(
        "signup",
        ip,
        "tc-b1l-blocked@example.com",
      );

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.blockedBy).toBe("ipLong");
      }
    });

    it("TC-B2. emailShort 차단 시 → { allowed: false, blockedBy: 'emailShort' }", () => {
      const ip1 = "10.0.12.1";
      const ip2 = "10.0.12.2";
      const email = "short-blocked@example.com";

      checkRequestEligibility("signup", ip1, email);

      // ip1과 다른 ip로 즉시 재시도 → emailShort에 걸려야 함
      const result = checkRequestEligibility("signup", ip2, email);

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.blockedBy).toBe("emailShort");
      }
    });

    it("TC-B3. emailLong 차단 시 → { allowed: false, blockedBy: 'emailLong' }", () => {
      const email = "long-blocked@example.com";

      for (let i = 0; i < EMAIL_LONG_LIMIT; i++) {
        checkRequestEligibility("signup", `10.0.13.${i}`, email);
        vi.advanceTimersByTime(EMAIL_SHORT_WINDOW_MS + 1000);
      }

      const result = checkRequestEligibility("signup", "10.0.13.99", email);

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.blockedBy).toBe("emailLong");
      }
    });

    it("TC-B4. IP short와 emailShort 동시 차단 시 → blockedBy: 'ipShort' (ipShort 우선)", () => {
      // [이유: blockedBy "ip" → "ipShort"로 rename됨. 우선순위: ipShort → ipLong → emailShort → emailLong]
      const ip = "10.0.14.1";
      const email = "priority@example.com";

      // IP short 한도 채우면서 동시에 emailShort도 채움
      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }
      // emailShort도 최근 요청이 있는 상태
      checkRequestEligibility("signup", "10.0.14.99", email);
      vi.advanceTimersByTime(100); // short window 내

      const result = checkRequestEligibility("signup", ip, email);

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        // ipShort 조건이 먼저 평가되므로 ipShort 우선
        expect(result.blockedBy).toBe("ipShort");
      }
    });

    it("TC-B5. 허용 시 → { allowed: true } (blockedBy 없음)", () => {
      const result = checkRequestEligibility(
        "signup",
        "10.0.15.1",
        "allowed@example.com",
      );

      expect(result.allowed).toBe(true);
      expect((result as { blockedBy?: string }).blockedBy).toBeUndefined();
    });
  });

  describe("checkIpRateLimitPrecheck — 읽기 전용 IP 사전 검증", () => {
    it("TC-P1. IP 한도 이하 → { allowed: true }", () => {
      const ip = "10.200.0.1";
      const precheck = checkIpRateLimitPrecheck(ip);
      expect(precheck.allowed).toBe(true);
    });

    it("TC-P2. IP short 한도 초과 → { allowed: false }", () => {
      // [이유: IP_LIMIT → IP_SHORT_LIMIT으로 rename됨]
      const ip = "10.200.1.1";

      /**
       * IP short 한도 채우기
       */
      for (let i = 0; i < IP_SHORT_LIMIT; i++) {
        checkRequestEligibility("signup", ip, `user${i}@example.com`);
      }

      /**
       * 사전검증(precheck)에서 차단되어야 함
       */
      const precheck = checkIpRateLimitPrecheck(ip);
      expect(precheck.allowed).toBe(false);
    });

    it("TC-LP. IP long 한도 초과 시 precheck → { allowed: false }", () => {
      // [이유: precheck는 short + long 모두 read-only 평가해야 함]
      // [배치 전략: IP_LONG_WINDOW_MS 내에서 IP_SHORT_LIMIT개씩 배치로 IP_LONG_LIMIT 채우기]
      const ip = "10.200.3.1";

      // long 한도 채우기 (배치 전략)
      const batchCount = Math.ceil(IP_LONG_LIMIT / IP_SHORT_LIMIT);
      let requestIndex = 0;
      for (let batch = 0; batch < batchCount; batch++) {
        if (batch > 0) {
          vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);
        }
        const batchSize = Math.min(
          IP_SHORT_LIMIT,
          IP_LONG_LIMIT - batch * IP_SHORT_LIMIT,
        );
        for (let j = 0; j < batchSize; j++) {
          checkRequestEligibility(
            "signup",
            ip,
            `tc-lp-user${requestIndex}@example.com`,
          );
          requestIndex++;
        }
      }

      // short 리셋 후 precheck 호출 → long 한도 초과로 차단되어야 함
      vi.advanceTimersByTime(IP_SHORT_WINDOW_MS + 1);
      const precheck = checkIpRateLimitPrecheck(ip);
      expect(precheck.allowed).toBe(false);
    });

    it("TC-P2A. 경계값(timestamp === now - window)은 유효로 포함되어 평가된다", () => {
      // [이유: ipStore 구조가 RateLimitEntry → IpEligibilityEntry로 변경됨.
      //  shortWindow 직접 설정으로 경계값 검증]
      const ip = "10.200.1.2";
      const now = Date.now();
      const boundaryTs = now - IP_SHORT_WINDOW_MS;

      (
        ipStore as unknown as Map<
          string,
          { shortWindow: { timestamps: number[] } | null; longWindow: null }
        >
      ).set(ip, {
        shortWindow: {
          timestamps: Array.from({ length: IP_SHORT_LIMIT }, () => boundaryTs),
        },
        longWindow: null,
      });

      const precheck = checkIpRateLimitPrecheck(ip);
      expect(precheck.allowed).toBe(false);
    });

    it("TC-P3. 호출 후 ipStore 상태 변경 없음 (읽기 전용)", () => {
      // [이유: ipStore 구조가 IpEligibilityEntry로 변경됨 — shortWindow/longWindow 구조로 접근]
      const ip = "10.200.2.1";

      type IpEligibilityEntryShape = {
        shortWindow: { timestamps: number[] } | null;
        longWindow: { timestamps: number[] } | null;
      };

      /**
       * 초기 상태: IP 항목 없음
       */
      let precheck = checkIpRateLimitPrecheck(ip);
      expect(precheck.allowed).toBe(true);

      /**
       * 첫 번째 체크 후: 여전히 ipStore에 항목 없음 (precheck은 상태 변경 안 함)
       */
      let ipEntry = (
        ipStore as unknown as Map<string, IpEligibilityEntryShape>
      ).get(ip);
      expect(ipEntry).toBeUndefined();

      /**
       * checkRequestEligibility를 통해 상태를 생성해야 ipStore에 항목이 생김
       */
      checkRequestEligibility("signup", ip, "user@example.com");
      ipEntry = (
        ipStore as unknown as Map<string, IpEligibilityEntryShape>
      ).get(ip);
      expect(ipEntry).toBeDefined();
      // [이유: IpEligibilityEntry.shortWindow.timestamps에서 확인]
      expect(ipEntry?.shortWindow?.timestamps.length).toBe(1);

      /**
       * 사전검증(precheck) 호출 후 상태가 변경되지 않음
       */
      precheck = checkIpRateLimitPrecheck(ip);
      expect(precheck.allowed).toBe(true); // 아직 한도 이하
      ipEntry = (
        ipStore as unknown as Map<string, IpEligibilityEntryShape>
      ).get(ip);
      // [이유: precheck는 상태를 변경하지 않으므로 timestamps 길이가 그대로여야 함]
      expect(ipEntry?.shortWindow?.timestamps.length).toBe(1);
    });
  });
});
