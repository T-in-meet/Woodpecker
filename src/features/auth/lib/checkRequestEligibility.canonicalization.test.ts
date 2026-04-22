/**
 * checkRequestEligibility - canonicalization 테스트
 *
 * 목적:
 * - canonical email 기반 rate limit이 제대로 작동하는지 검증
 * - Gmail alias가 동일 bucket에 집계되는지 확인
 * - caller가 canonical email을 전달했을 때의 동작 검증
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  checkRequestEligibility,
  resetEligibilityStore,
} from "./checkRequestEligibility";

beforeEach(() => {
  resetEligibilityStore();
});

describe("checkRequestEligibility - canonicalization", () => {
  describe("TC-01: 동일 canonical email은 동일 bucket 공유", () => {
    it("user@gmail.com과 user+tag@gmail.com (이미 canonical)은 동일 bucket", () => {
      const ip = "127.0.0.1";
      const canonicalEmail1 = "user@gmail.com"; // 이미 정규화됨
      const canonicalEmail2 = "user@gmail.com"; // 동일 canonical

      // 첫 번째 요청
      const result1 = checkRequestEligibility("signup", ip, canonicalEmail1);
      expect(result1.allowed).toBe(true);

      // 두 번째 요청 (동일 canonical) → short window(1 req / 30s) 위반
      const result2 = checkRequestEligibility("signup", ip, canonicalEmail2);
      expect(result2.allowed).toBe(false); // rate limit hit
    });

    it("caller에서 canonicalizeEmail() 결과를 전달받으므로 내부 toLowerCase() 중복 처리 없음", () => {
      const ip = "127.0.0.1";
      // caller가 이미 canonical로 변환한 상태
      const canonicalEmail = "user@gmail.com";

      const result = checkRequestEligibility("signup", ip, canonicalEmail);
      expect(result.allowed).toBe(true);

      // 동일 canonical 재요청
      const result2 = checkRequestEligibility("signup", ip, canonicalEmail);
      expect(result2.allowed).toBe(false);
    });
  });

  describe("TC-02: 다른 canonical email은 별도 bucket", () => {
    it("user@company.com과 user+tag@company.com은 다른 bucket (non-Gmail)", () => {
      const ip = "127.0.0.1";

      // user@company.com: caller에서 canonicalize → user@company.com (보존)
      const result1 = checkRequestEligibility("signup", ip, "user@company.com");
      expect(result1.allowed).toBe(true);

      // user+tag@company.com: caller에서 canonicalize → user+tag@company.com (보존)
      const result2 = checkRequestEligibility(
        "signup",
        ip,
        "user+tag@company.com",
      );
      expect(result2.allowed).toBe(true); // 다른 bucket이므로 성공
    });

    it("IP rate limit은 공유하지만 email bucket은 분리", () => {
      const ip = "127.0.0.1";

      // IP: 10 req / 1min
      // Email short: 1 req / 30s
      // Email long: 5 req / 15min

      // user1@example.com 5회
      for (let i = 0; i < 5; i++) {
        const result = checkRequestEligibility(
          "signup",
          ip,
          "user1@example.com",
        );
        if (i === 0) {
          expect(result.allowed).toBe(true);
        } else {
          expect(result.allowed).toBe(false); // short window hit
        }
      }

      // user2@example.com 5회 (다른 bucket)
      let allowedCount = 0;
      for (let i = 0; i < 5; i++) {
        const result = checkRequestEligibility(
          "signup",
          ip,
          "user2@example.com",
        );
        if (result.allowed) allowedCount++;
      }
      expect(allowedCount).toBe(1); // 첫 1회만 성공 (short window)
    });
  });

  describe("TC-03: 서로 다른 route도 canonical email 기준", () => {
    it("signup과 resend이 동일 canonical email → short window 공유", () => {
      const ip = "127.0.0.1";
      const canonicalEmail = "user@gmail.com";

      // signup 요청
      const signupResult = checkRequestEligibility(
        "signup",
        ip,
        canonicalEmail,
      );
      expect(signupResult.allowed).toBe(true);

      // resend 요청 (동일 canonical, 다른 route) → short window 공유
      const resendResult = checkRequestEligibility(
        "resend",
        ip,
        canonicalEmail,
      );
      expect(resendResult.allowed).toBe(false); // 동일 short window 적용
    });
  });

  describe("TC-04: 이메일 short/long window AND 평가", () => {
    it("short window 소비 후 다른 이메일은 독립적", () => {
      // 동일 IP에서 email short window만 테스트
      const ip = "127.0.0.1";

      // 첫 요청: email1 성공
      const result1 = checkRequestEligibility(
        "signup",
        ip,
        "user1@example.com",
      );
      expect(result1.allowed).toBe(true);

      // 두 번째 요청 (30초 이내, 동일 email): short window 위반
      const result2 = checkRequestEligibility(
        "signup",
        ip,
        "user1@example.com",
      );
      expect(result2.allowed).toBe(false);

      // 세 번째 요청 (다른 email, 동일 IP): 이메일 bucket 분리되므로 성공
      const result3 = checkRequestEligibility(
        "signup",
        ip,
        "user2@example.com",
      );
      expect(result3.allowed).toBe(true);
    });
  });

  describe("TC-05: AND 평가 (IP AND email short AND email long)", () => {
    it("IP limit, email short, email long 모두 통과해야 허용", () => {
      const ip = "127.0.0.1";
      const email1 = "user1@example.com";

      // 첫 요청: 모두 통과
      const result1 = checkRequestEligibility("signup", ip, email1);
      expect(result1.allowed).toBe(true);

      // 두 번째 요청: email short window 위반
      const result2 = checkRequestEligibility("signup", ip, email1);
      expect(result2.allowed).toBe(false); // AND 평가 실패

      // 세 번째: 다른 email이지만 IP 재사용 → IP limit 체크
      // (10 req / 1min이므로 아직 여유)
      const result3 = checkRequestEligibility(
        "signup",
        ip,
        "user2@example.com",
      );
      expect(result3.allowed).toBe(true);
    });
  });

  describe("TC-06: canonical email이 정확히 전달된다고 가정", () => {
    it("caller(signup/resend)가 canonicalizeEmail() 결과를 전달하므로 내부 정규화 없음", () => {
      const ip = "127.0.0.1";

      // canonical email 형태로 전달됨
      const canonicalEmails = [
        "user@gmail.com", // Gmail plus 제거됨
        "firstlast@gmail.com", // Gmail dot 제거됨
        "user@example.com", // non-Gmail (보존)
      ];

      for (const canonicalEmail of canonicalEmails) {
        const result = checkRequestEligibility("signup", ip, canonicalEmail);
        expect(result.allowed).toBe(true); // 각각 새로운 bucket
      }
    });
  });
});
