import { describe, expect, it } from "vitest";

import { canonicalizeEmail } from "./canonicalizeEmail";

describe("canonicalizeEmail — 이메일 정규화", () => {
  describe("Gmail plus 주소 정규화", () => {
    it("TC-01: Gmail 주소의 plus 태그를 제거한다", () => {
      expect(canonicalizeEmail("user+tag@gmail.com")).toBe("user@gmail.com");
    });

    it("TC-02: 여러 글자로 된 plus 태그를 제거한다", () => {
      expect(canonicalizeEmail("user+notification@gmail.com")).toBe(
        "user@gmail.com",
      );
    });

    it("TC-03: plus 이후의 모든 문자열을 제거한다", () => {
      expect(canonicalizeEmail("user+a+b@gmail.com")).toBe("user@gmail.com");
    });
  });

  describe("Gmail dot 제거", () => {
    it("TC-04: Gmail local part의 dot을 제거한다", () => {
      expect(canonicalizeEmail("u.s.e.r@gmail.com")).toBe("user@gmail.com");
    });

    it("TC-05: Gmail local part의 단일 dot을 제거한다", () => {
      expect(canonicalizeEmail("first.last@gmail.com")).toBe(
        "firstlast@gmail.com",
      );
    });

    it("TC-06: local part 앞쪽 dot도 제거한다", () => {
      expect(canonicalizeEmail(".user@gmail.com")).toBe("user@gmail.com");
    });

    it("TC-07: local part 뒤쪽 dot도 제거한다", () => {
      expect(canonicalizeEmail("user.@gmail.com")).toBe("user@gmail.com");
    });
  });

  describe("Gmail 복합 정규화", () => {
    it("TC-08: dot과 plus 태그를 함께 제거한다", () => {
      expect(canonicalizeEmail("u.s.e.r+tag@gmail.com")).toBe("user@gmail.com");
    });

    it("TC-09: 복합 plus 태그도 제거한다", () => {
      expect(canonicalizeEmail("u.s.e.r+notification+tag@gmail.com")).toBe(
        "user@gmail.com",
      );
    });

    it("TC-10: 대소문자, dot, plus가 함께 있어도 정규화한다", () => {
      expect(canonicalizeEmail("U.S.E.R+TAG@Gmail.COM")).toBe("user@gmail.com");
    });
  });

  describe("googlemail.com 도메인 통일", () => {
    it("TC-11: googlemail.com을 gmail.com으로 변환한다", () => {
      expect(canonicalizeEmail("user@googlemail.com")).toBe("user@gmail.com");
    });

    it("TC-12: googlemail.com 주소의 dot을 제거한다", () => {
      expect(canonicalizeEmail("u.s.e.r@googlemail.com")).toBe(
        "user@gmail.com",
      );
    });

    it("TC-13: googlemail.com 주소의 plus 태그를 제거한다", () => {
      expect(canonicalizeEmail("user+tag@googlemail.com")).toBe(
        "user@gmail.com",
      );
    });

    it("TC-14: 대문자가 포함된 googlemail.com도 gmail.com으로 통일한다", () => {
      expect(canonicalizeEmail("user@GoogleMail.COM")).toBe("user@gmail.com");
    });

    it("TC-15: googlemail.com 주소의 dot과 plus를 함께 정규화한다", () => {
      expect(canonicalizeEmail("u.s.e.r+tag@GOOGLEMAIL.COM")).toBe(
        "user@gmail.com",
      );
    });
  });

  describe("Gmail이 아닌 도메인 처리", () => {
    it("TC-16: Gmail이 아닌 도메인의 plus 주소는 유지한다", () => {
      expect(canonicalizeEmail("user+tag@company.com")).toBe(
        "user+tag@company.com",
      );
    });

    it("TC-17: Gmail이 아닌 도메인의 dot은 유지한다", () => {
      expect(canonicalizeEmail("user.name@company.com")).toBe(
        "user.name@company.com",
      );
    });

    it("TC-18: Gmail이 아닌 도메인의 dot과 plus를 모두 유지한다", () => {
      expect(canonicalizeEmail("user.name+tag@company.com")).toBe(
        "user.name+tag@company.com",
      );
    });

    it("TC-19: Gmail이 아닌 도메인의 소문자 주소는 그대로 유지한다", () => {
      expect(canonicalizeEmail("user@example.com")).toBe("user@example.com");
    });

    it("TC-20: Gmail이 아닌 도메인의 대문자는 소문자로 변환한다", () => {
      expect(canonicalizeEmail("user@EXAMPLE.COM")).toBe("user@example.com");
    });
  });

  describe("대소문자 정규화", () => {
    it("TC-21: 대문자는 소문자로 변환한다", () => {
      expect(canonicalizeEmail("USER@EXAMPLE.COM")).toBe("user@example.com");
    });

    it("TC-22: 혼합 대소문자는 소문자로 정규화한다", () => {
      expect(canonicalizeEmail("User@Example.COM")).toBe("user@example.com");
    });
  });

  describe("경계 케이스", () => {
    it("TC-23: plus 제거 후 local part가 비어 있어도 처리한다", () => {
      expect(canonicalizeEmail("+tag@gmail.com")).toBe("@gmail.com");
    });

    it("TC-24: 특수 규칙이 없는 Gmail 주소는 그대로 유지한다", () => {
      expect(canonicalizeEmail("user@gmail.com")).toBe("user@gmail.com");
    });

    it("TC-25: @가 여러 개 있으면 마지막 @를 기준으로 처리한다", () => {
      expect(canonicalizeEmail("user+@fake@gmail.com")).toBe("user@gmail.com");
    });

    it("TC-26: @가 없는 입력은 그대로 반환한다", () => {
      expect(canonicalizeEmail("notanemail")).toBe("notanemail");
    });
  });

  describe("결정성", () => {
    it("TC-27: 같은 입력은 항상 같은 결과를 반환한다", () => {
      const input = "User+Tag@Gmail.COM";
      const result1 = canonicalizeEmail(input);
      const result2 = canonicalizeEmail(input);
      expect(result1).toBe(result2);
    });

    it("TC-28: 여러 번 호출해도 결과가 동일하다", () => {
      const input = "user@example.com";
      const result1 = canonicalizeEmail(input);
      const result2 = canonicalizeEmail(result1);
      expect(result1).toBe(result2);
    });
  });
});
