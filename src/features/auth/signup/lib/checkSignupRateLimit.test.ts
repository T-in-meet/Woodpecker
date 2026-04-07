/**
 * PR-UI-15 회원가입 rate limit - IP rollback 검증
 *
 * 이 파일은 checkSignupRateLimit의 rollback 동작과
 * 기존 IP/email limit 정책의 회귀 여부를 검증한다.
 *
 * 검증 항목:
 * - IP 허용 + email 차단 시 최종 결과 blocked
 * - email 차단 요청 이후 IP rollback 반영 여부 (연속 호출 기반)
 * - email 차단 없는 정상 흐름에서 IP count 소모 동작 (rollback 대조군)
 * - 기존 IP limit 초과 차단 동작 유지
 * - 기존 email limit 초과 차단 동작 유지
 *
 * mock: 없음
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkSignupRateLimit,
  resetRateLimitStores,
} from "./checkSignupRateLimit";

beforeEach(() => {
  resetRateLimitStores();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PR-UI-15 회원가입 rate limit - IP rollback 검증", () => {
  it("TC-01. IP는 허용되고 email이 차단된 경우 최종 결과는 blocked이다", async () => {
    // email limit 소진 (5회, 다른 IP에서)
    for (let i = 0; i < 5; i++) {
      await checkSignupRateLimit(`10.0.${i}.1`, "blocked@tc01.com");
    }

    // IP는 clean, email은 차단된 상태에서 요청
    const result = await checkSignupRateLimit("10.1.1.1", "blocked@tc01.com");

    expect(result.allowed).toBe(false);
  });

  it("TC-02. email 차단으로 실패한 요청 이후 동일 IP 재시도 시 rollback이 반영되어 IP limit가 추가 소모되지 않는다", async () => {
    const ip = "10.2.1.1";

    // IP count를 9까지 소진 (fresh email들로 정상 허용)
    for (let i = 0; i < 9; i++) {
      await checkSignupRateLimit(ip, `fresh${i}@tc02.com`);
    }

    // email limit 소진 (다른 IP에서 5회)
    for (let i = 0; i < 5; i++) {
      await checkSignupRateLimit(`10.0.${i}.2`, "blocked@tc02.com");
    }

    // 1차 호출: IP count 9 → 10 증가 후 email 차단 → rollback으로 IP count 9 복원
    const blockedResult = await checkSignupRateLimit(ip, "blocked@tc02.com");
    expect(blockedResult.allowed).toBe(false);

    // 2차 호출: rollback 적용 시 IP count = 9이므로 허용 (10번째 소비)
    //           rollback 미적용 시 IP count = 10이므로 차단됨
    const retryResult = await checkSignupRateLimit(ip, "retry@tc02.com");
    expect(retryResult.allowed).toBe(true);
  });

  it("TC-03. rollback 검증은 email 차단이 없을 때의 정상 IP limit 소모 동작과 구분되어야 한다", async () => {
    const ip = "10.3.1.1";

    // email 차단 없이 IP를 10회 모두 소진 (정상 허용 흐름)
    for (let i = 0; i < 10; i++) {
      const result = await checkSignupRateLimit(ip, `fresh${i}@tc03.com`);
      expect(result.allowed).toBe(true);
    }

    // email 차단 없는 11번째 요청은 IP limit 소모로 차단 (rollback 없음)
    const result = await checkSignupRateLimit(ip, "overflow@tc03.com");
    expect(result.allowed).toBe(false);
  });

  it("TC-04. 기존 IP limit 초과 시 차단 동작은 그대로 유지된다", async () => {
    const ip = "10.4.1.1";

    for (let i = 0; i < 10; i++) {
      await checkSignupRateLimit(ip, `user${i}@tc04.com`);
    }

    const result = await checkSignupRateLimit(ip, "overflow@tc04.com");

    expect(result.allowed).toBe(false);
  });

  it("TC-05. 기존 email limit 초과 시 차단 동작은 그대로 유지된다", async () => {
    const email = "target@tc05.com";

    for (let i = 0; i < 5; i++) {
      await checkSignupRateLimit(`10.5.${i}.1`, email);
    }

    const result = await checkSignupRateLimit("10.5.9.1", email);

    expect(result.allowed).toBe(false);
  });
});
