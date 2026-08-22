import { describe, expect, it } from "vitest";

import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";

describe("validateRedirectPath 디코딩 전 위험 패턴 차단", () => {
  describe("경로 형식 위반", () => {
    it("/로 시작하지 않는 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("mypage")).toBe("/mypage");
    });

    it("https 절대 URL은 /mypage를 반환한다", () => {
      expect(validateRedirectPath("https://evil.com/mypage")).toBe("/mypage");
    });

    it("http 절대 URL은 /mypage를 반환한다", () => {
      expect(validateRedirectPath("http://evil.com/mypage")).toBe("/mypage");
    });

    it("protocol-relative URL은 /mypage를 반환한다", () => {
      expect(validateRedirectPath("//evil.com/mypage")).toBe("/mypage");
    });

    it("javascript: scheme은 /mypage를 반환한다", () => {
      expect(validateRedirectPath("javascript:alert(1)")).toBe("/mypage");
    });

    it("data: scheme은 /mypage를 반환한다", () => {
      expect(validateRedirectPath("data:text/html,<h1>hi</h1>")).toBe(
        "/mypage",
      );
    });

    it("역슬래시가 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/my\\page")).toBe("/mypage");
    });

    it('" https://evil.com/mypage " (앞뒤 공백)는 trim 후 절대 URL → /mypage를 반환한다', () => {
      expect(validateRedirectPath(" https://evil.com/mypage ")).toBe("/mypage");
    });

    it('" //evil.com/mypage " (앞뒤 공백)는 trim 후 protocol-relative URL → /mypage를 반환한다', () => {
      expect(validateRedirectPath(" //evil.com/mypage ")).toBe("/mypage");
    });

    it('"/my page"는 내부 공백 포함 → /mypage를 반환한다', () => {
      expect(validateRedirectPath("/my page")).toBe("/mypage");
    });
  });

  describe("URL 부가 요소", () => {
    it("허용되지 않은 query string은 제거한다", () => {
      expect(validateRedirectPath("/mypage?foo=bar")).toBe("/mypage");
    });

    it("fragment가 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/mypage#section")).toBe("/mypage");
    });

    it('" /mypage?foo=bar " (앞뒤 공백)는 trim 후 허용되지 않은 query를 제거한다', () => {
      expect(validateRedirectPath(" /mypage?foo=bar ")).toBe("/mypage");
    });

    it('" /mypage#section " (앞뒤 공백)는 trim 후 fragment 포함 → /mypage를 반환한다', () => {
      expect(validateRedirectPath(" /mypage#section ")).toBe("/mypage");
    });

    it('" /notes/123?x=1 " (앞뒤 공백)는 trim 후 query string 포함 → /mypage를 반환한다', () => {
      expect(validateRedirectPath(" /notes/123?x=1 ")).toBe("/mypage");
    });

    it("/notes%3Fredirect%3D/admin는 인코딩된 query 문자가 포함된 입력이므로 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes%3Fredirect%3D/admin")).toBe(
        "/mypage",
      );
    });

    it('"/mypage?"는 query 문자열이 비어 있어도 /mypage를 반환한다', () => {
      expect(validateRedirectPath("/mypage?")).toBe("/mypage");
    });

    it('"/mypage#"는 fragment가 비어 있어도 /mypage를 반환한다', () => {
      expect(validateRedirectPath("/mypage#")).toBe("/mypage");
    });

    it('" /mypage? " (앞뒤 공백)는 trim 후 empty query 포함 → /mypage를 반환한다', () => {
      expect(validateRedirectPath(" /mypage? ")).toBe("/mypage");
    });

    it('" /mypage# " (앞뒤 공백)는 trim 후 empty fragment 포함 → /mypage를 반환한다', () => {
      expect(validateRedirectPath(" /mypage# ")).toBe("/mypage");
    });
  });

  describe("정책상 차단 경로", () => {
    it("/login은 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/login")).toBe("/mypage");
    });

    it("/signup은 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/signup")).toBe("/mypage");
    });

    it("/resend-email은 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/resend-email")).toBe("/mypage");
    });

    it("/privacy는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/privacy")).toBe("/mypage");
    });

    it("/terms는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/terms")).toBe("/mypage");
    });

    it("/api/ 하위 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/api/anything")).toBe("/mypage");
    });

    it("/api/ 자체도 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/api/")).toBe("/mypage");
    });

    it("/api (trailing slash 없음)는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/api")).toBe("/mypage");
    });

    it("/api/v1/users (중첩 경로)는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/api/v1/users")).toBe("/mypage");
    });

    it("/api//test (이중 슬래시)는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/api//test")).toBe("/mypage");
    });

    it("/api// (이중 슬래시 trailing)는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/api//")).toBe("/mypage");
    });

    it("/api/%2Ftest는 decode 후 /api//test — 이중 슬래시 생성 → /mypage를 반환한다", () => {
      expect(validateRedirectPath("/api/%2Ftest")).toBe("/mypage");
    });
  });

  describe("percent-encoding 우회", () => {
    it("percent-encoded 슬래시가 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/%2Fetc")).toBe("/mypage");
    });

    it("percent-encoded 역슬래시가 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/%5C")).toBe("/mypage");
    });

    it("/%2Fapi는 디코딩 전 슬래시 우회 패턴 → /mypage를 반환한다", () => {
      expect(validateRedirectPath("/%2Fapi")).toBe("/mypage");
    });

    it("/%5Cnotes는 디코딩 전 역슬래시 우회 패턴 → /mypage를 반환한다", () => {
      expect(validateRedirectPath("/%5Cnotes")).toBe("/mypage");
    });

    it("/%2F%2Fexample.com은 디코딩 전 protocol-relative 우회 패턴 → /mypage를 반환한다", () => {
      expect(validateRedirectPath("/%2F%2Fexample.com")).toBe("/mypage");
    });

    it("http:%2F%2Fexample.com은 디코딩 전 http scheme 우회 패턴 → /mypage를 반환한다", () => {
      expect(validateRedirectPath("http:%2F%2Fexample.com")).toBe("/mypage");
    });

    it("javascript:%2F%2Fexample.com은 디코딩 전 javascript scheme 우회 패턴 → /mypage를 반환한다", () => {
      expect(validateRedirectPath("javascript:%2F%2Fexample.com")).toBe(
        "/mypage",
      );
    });

    it("/api%2F%2Ftest는 디코딩 전 이중 슬래시 api 우회 패턴 → /mypage를 반환한다", () => {
      expect(validateRedirectPath("/api%2F%2Ftest")).toBe("/mypage");
    });

    it("/api%2f%2ftest (소문자)는 디코딩 전 이중 슬래시 api 우회 패턴 → /mypage를 반환한다", () => {
      expect(validateRedirectPath("/api%2f%2ftest")).toBe("/mypage");
    });

    it("디코딩 전 검사로 위험 패턴은 decode 없이도 반드시 차단된다", () => {
      // %2F → / 로 해석될 수 있는 경로는 디코딩 전에도 차단됨
      expect(validateRedirectPath("/notes%2F%2E%2E")).toBe("/mypage");
    });

    it("디코딩 전 위험 패턴을 포함한 인코딩 값은 /mypage를 반환한다", () => {
      // %2F%2E%2E → /../ — 디코딩 후 path traversal이 드러남
      expect(validateRedirectPath("/notes/%2F%2E%2E")).toBe("/mypage");
    });

    it("percent-encoding된 slash(%2F)는 디코딩 전 위험 패턴으로 차단되므로 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes%2Fnew")).toBe("/mypage");
    });
  });
});
