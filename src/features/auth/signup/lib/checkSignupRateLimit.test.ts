/**
 * 회원가입 rate limit - 단계형 정책 검증
 *
 * 새 정책:
 * - IP rate limit은 요청 초기에 적용되어 invalid/malformed 요청 flood까지 조기 차단한다.
 * - Email rate limit은 validation 이후, 정규화된 이메일 기준으로 적용된다.
 * - IP와 Email은 서로 다른 window 정책을 사용한다.
 *
 * 이 파일은 route 통합 테스트가 아니라 rate limit 유틸의 정책 자체를 검증한다.
 * 따라서 "언제 호출되는가"는 route 테스트에서 다루고, 여기서는 "호출되었을 때 어떤
 * 차단 규칙으로 동작하는가"에 집중한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkSignupEmailRateLimit,
  checkSignupIpRateLimit,
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

describe("회원가입 rate limit - 단계형 정책 검증", () => {
  it("TC-01. 동일 IP는 10번까지 허용되고 11번째 요청부터 차단된다", async () => {
    const ip = "10.1.1.1";

    for (let i = 0; i < 10; i++) {
      const result = await checkSignupIpRateLimit(ip);
      expect(result.allowed).toBe(true);
    }

    const blocked = await checkSignupIpRateLimit(ip);

    expect(blocked.allowed).toBe(false);
  });

  it("TC-02. IP rate limit은 1분 window 만료 후 리셋된다", async () => {
    const ip = "10.2.1.1";

    for (let i = 0; i < 10; i++) {
      await checkSignupIpRateLimit(ip);
    }

    expect((await checkSignupIpRateLimit(ip)).allowed).toBe(false);

    vi.advanceTimersByTime(61 * 1000);

    expect((await checkSignupIpRateLimit(ip)).allowed).toBe(true);
  });

  it("TC-03. 동일 이메일은 5번까지 허용되고 6번째 요청부터 차단된다", async () => {
    const email = "target@example.com";

    for (let i = 0; i < 5; i++) {
      const result = await checkSignupEmailRateLimit(email);
      expect(result.allowed).toBe(true);
    }

    const blocked = await checkSignupEmailRateLimit(email);

    expect(blocked.allowed).toBe(false);
  });

  it("TC-04. email rate limit은 더 긴 window 만료 후 리셋된다", async () => {
    const email = "reset@example.com";

    for (let i = 0; i < 5; i++) {
      await checkSignupEmailRateLimit(email);
    }

    expect((await checkSignupEmailRateLimit(email)).allowed).toBe(false);

    vi.advanceTimersByTime(14 * 60 * 1000);
    expect((await checkSignupEmailRateLimit(email)).allowed).toBe(false);

    vi.advanceTimersByTime(61 * 1000);
    expect((await checkSignupEmailRateLimit(email)).allowed).toBe(true);
  });

  it("TC-05. IP rate limit과 email rate limit은 서로 독립적으로 동작한다", async () => {
    const ip = "10.5.1.1";
    const email = "independent@example.com";

    for (let i = 0; i < 10; i++) {
      await checkSignupIpRateLimit(ip);
    }

    expect((await checkSignupIpRateLimit(ip)).allowed).toBe(false);
    expect((await checkSignupEmailRateLimit(email)).allowed).toBe(true);
  });

  it("TC-06. email limit이 소진되어도 별도의 IP 카운트 롤백 개념은 존재하지 않는다", async () => {
    const ip = "10.6.1.1";
    const blockedEmail = "blocked@example.com";

    for (let i = 0; i < 9; i++) {
      expect((await checkSignupIpRateLimit(ip)).allowed).toBe(true);
    }

    for (let i = 0; i < 5; i++) {
      expect((await checkSignupEmailRateLimit(blockedEmail)).allowed).toBe(
        true,
      );
    }

    expect((await checkSignupEmailRateLimit(blockedEmail)).allowed).toBe(false);

    // 단계형 정책에서는 IP와 email이 별도 버킷이므로, email 차단이 IP count를 되돌리지 않는다.
    expect((await checkSignupIpRateLimit(ip)).allowed).toBe(true);
    expect((await checkSignupIpRateLimit(ip)).allowed).toBe(false);
  });

  it("TC-07. 정규화된 동일 이메일 기준 정책을 따르므로 소문자 email key로 일관되게 차단된다", async () => {
    const normalizedEmail = "mixedcase@example.com";

    for (let i = 0; i < 5; i++) {
      expect((await checkSignupEmailRateLimit(normalizedEmail)).allowed).toBe(
        true,
      );
    }

    expect((await checkSignupEmailRateLimit(normalizedEmail)).allowed).toBe(
      false,
    );
  });
});
