import { describe, expect, it } from "vitest";

import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";

describe("validateRedirectPath 반환 계약", () => {
  // throw하지 않는다
  it("null을 받아도 예외를 발생시키지 않는다", () => {
    expect(() => validateRedirectPath(null)).not.toThrow();
  });

  it("악의적인 문자열을 받아도 예외를 발생시키지 않는다", () => {
    expect(() =>
      validateRedirectPath("javascript:alert(document.cookie)"),
    ).not.toThrow();
  });

  it("잘못된 percent-encoding을 받아도 예외를 발생시키지 않는다", () => {
    expect(() => validateRedirectPath("/notes/%gg")).not.toThrow();
  });

  it("매우 긴 문자열을 받아도 예외를 발생시키지 않는다", () => {
    expect(() => validateRedirectPath("/" + "a".repeat(10000))).not.toThrow();
  });
  // 항상 string을 반환한다
  it("악의적인 문자열을 넣어도 반환값 타입은 항상 string이다", () => {
    const result = validateRedirectPath("javascript:alert(document.cookie)");

    expect(typeof result).toBe("string");
  });

  it("null을 넣어도 반환값 타입은 항상 string이다", () => {
    const result = validateRedirectPath(null);

    expect(typeof result).toBe("string");
    expect(result).toBe("/mypage");
  });

  // invalid 입력은 /mypage를 반환한다
  it("잘못된 percent-encoding을 넣어도 정확히 /mypage를 반환한다", () => {
    expect(validateRedirectPath("/notes/%gg")).toBe("/mypage");
  });
});
