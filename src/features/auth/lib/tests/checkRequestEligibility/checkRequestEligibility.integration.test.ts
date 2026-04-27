/**
 * 요청 허용성 시스템 — 통합 decision flow 검증
 *
 * IP short/long, email short/long 조건이 단일 진입점에서
 * 함께 평가되고, 차단 원인과 상태 갱신이 일관되게 처리되는지 검증한다.
 *
 * 검증 범위:
 * - AND 조건 평가
 * - allowed=true일 때만 원자적 상태 갱신
 * - 내부 차단 원인이 달라도 외부 observable 동일성 유지
 * - blockedBy 반환값 및 우선순위
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRequestEligibility,
  EMAIL_LONG_LIMIT,
  EMAIL_SHORT_LIMIT,
  EMAIL_SHORT_WINDOW_MS,
  IP_LONG_LIMIT,
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

describe("checkRequestEligibility — 통합 decision flow", () => {
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
});
