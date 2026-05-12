import { describe, expect, it } from "vitest";

import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";

describe("validateRedirectPath 입력 정규화", () => {
  describe("null / undefined / 비문자열", () => {
    it("null을 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath(null)).toBe("/mypage");
    });

    it("undefined를 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath(undefined)).toBe("/mypage");
    });

    it("빈 문자열을 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath("")).toBe("/mypage");
    });

    it("숫자를 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath(42)).toBe("/mypage");
    });

    it("객체를 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath({})).toBe("/mypage");
    });

    it("true를 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath(true)).toBe("/mypage");
    });

    it("false를 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath(false)).toBe("/mypage");
    });

    it("배열을 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath([])).toBe("/mypage");
    });

    it("문자열 배열을 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath(["/mypage"])).toBe("/mypage");
    });
  });
  describe("trim 처리", () => {
    it('" /mypage " (앞뒤 공백)는 trim 후 /mypage를 반환한다', () => {
      expect(validateRedirectPath(" /mypage ")).toBe("/mypage");
    });

    it('"   /notes   " (앞뒤 공백)는 trim 후 /notes를 반환한다', () => {
      expect(validateRedirectPath("   /notes   ")).toBe("/notes");
    });

    it('" /notes/new " (앞뒤 공백)는 trim 후 /notes/new를 반환한다', () => {
      expect(validateRedirectPath(" /notes/new ")).toBe("/notes/new");
    });

    it('"\\t/notes/new\\t" (앞뒤 탭)는 trim 후 /notes/new를 반환한다', () => {
      expect(validateRedirectPath("\t/notes/new\t")).toBe("/notes/new");
    });

    it('" /notes/550e8400-e29b-41d4-a716-446655440000 " (앞뒤 공백)는 trim 후 UUID noteId 경로를 반환한다', () => {
      expect(
        validateRedirectPath(" /notes/550e8400-e29b-41d4-a716-446655440000 "),
      ).toBe("/notes/550e8400-e29b-41d4-a716-446655440000");
    });
  });
  describe("trim 후 빈 문자열", () => {
    it("공백만 있는 문자열을 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath("  ")).toBe("/mypage");
    });

    it("탭 문자만 있는 문자열은 trim 후 빈 문자열 → /mypage를 반환한다", () => {
      expect(validateRedirectPath("\t")).toBe("/mypage");
    });

    it("개행 문자만 있는 문자열은 trim 후 빈 문자열 → /mypage를 반환한다", () => {
      expect(validateRedirectPath("\n")).toBe("/mypage");
    });

    it('"\\r\\n"은 trim 후 빈 문자열 → /mypage를 반환한다', () => {
      expect(validateRedirectPath("\r\n")).toBe("/mypage");
    });

    it('" \\t \\n " (공백/탭/개행 혼합)은 trim 후 빈 문자열 → /mypage를 반환한다', () => {
      expect(validateRedirectPath(" \t \n ")).toBe("/mypage");
    });
  });
});
