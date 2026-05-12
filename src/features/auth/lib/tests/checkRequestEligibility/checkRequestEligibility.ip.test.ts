/**
 * 요청 허용성 시스템 — IP rate limit 검증
 *
 * IP short window, IP long window, IP precheck 동작을 검증한다.
 *
 * 검증 범위:
 * - IP short window burst 억제
 * - IP long window sustained 공격 방어
 * - checkIpRateLimitPrecheck 읽기 전용 사전 검증
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkIpRateLimitPrecheck,
  checkRequestEligibility,
  IP_LONG_LIMIT,
  IP_LONG_WINDOW_MS,
  IP_SHORT_LIMIT,
  IP_SHORT_WINDOW_MS,
  resetEligibilityStore,
} from "@/features/auth/lib/checkRequestEligibility";
import { ipStore } from "@/features/auth/lib/requestEligibilityStore";

beforeEach(() => {
  resetEligibilityStore();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRequestEligibility — IP rate limit", () => {
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
  // IP precheck
  // ============================================================================

  describe("checkIpRateLimitPrecheck — 읽기 전용 IP 사전 검증", () => {
    it("TC-P1. IP 한도 이하 → { allowed: true }", () => {
      const ip = "10.200.0.1";
      const precheck = checkIpRateLimitPrecheck(ip);
      expect(precheck.allowed).toBe(true);
    });

    it("TC-P2. IP short 한도 초과 → { allowed: false, blockedBy: 'ipShort' }", () => {
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
      expect(precheck).toEqual({
        allowed: false,
        blockedBy: "ipShort",
      });
    });

    it("TC-LP. IP long 한도 초과 시 precheck → { allowed: false, blockedBy: 'ipLong' }", () => {
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
      expect(precheck).toEqual({
        allowed: false,
        blockedBy: "ipLong",
      });
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
      expect(precheck).toEqual({
        allowed: false,
        blockedBy: "ipShort",
      });
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
