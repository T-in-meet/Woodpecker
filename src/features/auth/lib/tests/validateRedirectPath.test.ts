import { describe, expect, it } from "vitest";

import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";

describe("validateRedirectPath", () => {
  describe("입력 정규화 — null/undefined/비문자열 입력은 /mypage로 대체", () => {
    it("null을 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath(null)).toBe("/mypage");
    });

    it("undefined를 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath(undefined)).toBe("/mypage");
    });

    it("빈 문자열을 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath("")).toBe("/mypage");
    });

    it("공백만 있는 문자열을 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath("  ")).toBe("/mypage");
    });

    it("숫자를 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath(42)).toBe("/mypage");
    });

    it("객체를 받으면 /mypage를 반환한다", () => {
      expect(validateRedirectPath({})).toBe("/mypage");
    });
  });

  describe("경로 형식 위반 — /로 시작하지 않거나 절대 URL이면 /mypage로 대체", () => {
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
  });

  describe("URL 부가 요소 — query string 또는 fragment가 포함되면 /mypage로 대체", () => {
    it("query string이 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/mypage?foo=bar")).toBe("/mypage");
    });

    it("fragment가 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/mypage#section")).toBe("/mypage");
    });
  });

  describe("인코딩 우회 및 제어 문자 — percent-encoding 우회나 제어 문자는 /mypage로 대체", () => {
    it("percent-encoded 슬래시가 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/%2Fetc")).toBe("/mypage");
    });

    it("percent-encoded 역슬래시가 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/%5C")).toBe("/mypage");
    });

    it("탭 문자가 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/my\tpage")).toBe("/mypage");
    });

    it("개행 문자가 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/my\npage")).toBe("/mypage");
    });

    it("잘못된 percent-encoding이 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/%gg")).toBe("/mypage");
    });

    it("디코딩 후 공백이 포함되는 경우 /mypage를 반환한다", () => {
      // %20 → 공백은 제어 문자로 간주하여 차단
      expect(validateRedirectPath("/notes/abc%20def")).toBe("/mypage");
    });
  });

  describe("path traversal — 상위 디렉토리 탐색 패턴은 /mypage로 대체", () => {
    it(".. 패턴이 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/../etc")).toBe("/mypage");
    });

    it(".. 로 끝나는 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/..")).toBe("/mypage");
    });

    it(". 로 끝나는 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/.")).toBe("/mypage");
    });

    it("루트 수준의 .. 는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/..")).toBe("/mypage");
    });

    it(". 만 포함된 segment는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/.")).toBe("/mypage");
    });
  });

  describe("정책상 차단 경로 — 허용 목록에 없는 앱 내부 경로는 /mypage로 대체", () => {
    it("/login은 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/login")).toBe("/mypage");
    });

    it("/signup은 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/signup")).toBe("/mypage");
    });

    it("/verify-email은 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/verify-email")).toBe("/mypage");
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
  });

  describe("exact match 허용 경로 — 허용된 경로는 그대로 반환", () => {
    it("/mypage는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/mypage")).toBe("/mypage");
    });

    it("/notes는 /notes를 반환한다", () => {
      expect(validateRedirectPath("/notes")).toBe("/notes");
    });

    it("/notes/new는 /notes/new를 반환한다", () => {
      expect(validateRedirectPath("/notes/new")).toBe("/notes/new");
    });
  });

  describe("dynamic match — /notes/[noteId] 패턴 검증", () => {
    it("/notes/123은 /notes/123을 반환한다", () => {
      expect(validateRedirectPath("/notes/123")).toBe("/notes/123");
    });

    it("/notes/abc-def는 /notes/abc-def를 반환한다", () => {
      expect(validateRedirectPath("/notes/abc-def")).toBe("/notes/abc-def");
    });

    it("/notes/ (빈 segment)는 /mypage를 반환한다", () => {
      // noteId가 비어 있으면 유효하지 않은 경로
      expect(validateRedirectPath("/notes/")).toBe("/mypage");
    });

    it("/notes/123/edit (추가 segment)는 /mypage를 반환한다", () => {
      // 정확히 하나의 segment만 허용
      expect(validateRedirectPath("/notes/123/edit")).toBe("/mypage");
    });

    it("/notes/. (path traversal)는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/.")).toBe("/mypage");
    });

    it("/notes/.. (path traversal)는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/..")).toBe("/mypage");
    });
  });

  describe("디코딩 규칙 — 디코딩 전후 모두 위험 패턴을 검사", () => {
    it("디코딩 전 위험 패턴을 포함한 인코딩 값은 /mypage를 반환한다", () => {
      // %2F%2E%2E → /../ — 디코딩 후 path traversal이 드러남
      expect(validateRedirectPath("/notes/%2F%2E%2E")).toBe("/mypage");
    });

    it("디코딩 후 슬래시가 포함되는 경우 /mypage를 반환한다", () => {
      // %2F → / — 디코딩 후 슬래시가 드러나 추가 segment처럼 동작함
      expect(validateRedirectPath("/notes/%2F123")).toBe("/mypage");
    });
  });

  describe("예외 미발생 보장 — 어떤 입력에도 throw하지 않음", () => {
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
  });
});
