import { describe, expect, it } from "vitest";

import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";

describe("validateRedirectPath", () => {
  describe("0. 반환 계약", () => {
    // throw하지 않는다
    // 항상 string을 반환한다
    // invalid 입력은 /mypage를 반환한다
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

  describe("1. 입력 정규화", () => {
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

      it('"  /mypage  " (앞뒤 이중 공백)는 trim 후 /mypage를 반환한다', () => {
        expect(validateRedirectPath("  /mypage  ")).toBe("/mypage");
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

  describe("2. 디코딩 전 위험 패턴 차단", () => {
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
        expect(validateRedirectPath(" https://evil.com/mypage ")).toBe(
          "/mypage",
        );
      });

      it('" //evil.com/mypage " (앞뒤 공백)는 trim 후 protocol-relative URL → /mypage를 반환한다', () => {
        expect(validateRedirectPath(" //evil.com/mypage ")).toBe("/mypage");
      });
    });

    describe("URL 부가 요소", () => {
      it("query string이 포함된 경로는 /mypage를 반환한다", () => {
        expect(validateRedirectPath("/mypage?foo=bar")).toBe("/mypage");
      });

      it("fragment가 포함된 경로는 /mypage를 반환한다", () => {
        expect(validateRedirectPath("/mypage#section")).toBe("/mypage");
      });

      it('" /mypage?foo=bar " (앞뒤 공백)는 trim 후 query string 포함 → /mypage를 반환한다', () => {
        expect(validateRedirectPath(" /mypage?foo=bar ")).toBe("/mypage");
      });

      it('" /mypage#section " (앞뒤 공백)는 trim 후 fragment 포함 → /mypage를 반환한다', () => {
        expect(validateRedirectPath(" /mypage#section ")).toBe("/mypage");
      });

      it('" /notes/123?x=1 " (앞뒤 공백)는 trim 후 query string 포함 → /mypage를 반환한다', () => {
        expect(validateRedirectPath(" /notes/123?x=1 ")).toBe("/mypage");
      });

      it("/notes%3Fredirect%3D/admin는 디코딩 전 쿼리 문자 우회 패턴 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes%3Fredirect%3D/admin")).toBe(
          "/mypage",
        );
      });
    });

    describe("정책상 차단 경로", () => {
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

  describe("3. 1회 디코딩", () => {
    describe("정상 decode", () => {
      it("/notes/%41은 정상 decode → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%41")).toBe("/mypage");
      });

      it("/notes/%35%35%30e8400-e29b-41d4-a716-446655440000은 1회 decode 후 UUID 형식이면 허용한다", () => {
        expect(
          validateRedirectPath(
            "/notes/%35%35%30e8400-e29b-41d4-a716-446655440000",
          ),
        ).toBe("/notes/550e8400-e29b-41d4-a716-446655440000");
      });

      it("/notes/%35%35%30e8400-e29b-41d4-a716-44665544zzzz는 1회 decode 후 UUID 형식이 아니므로 /mypage를 반환한다", () => {
        expect(
          validateRedirectPath(
            "/notes/%35%35%30e8400-e29b-41d4-a716-44665544zzzz",
          ),
        ).toBe("/mypage");
      });

      it("/notes/%31%32%33e4567-e89b-42d3-a456-426614174000은 1회 decode 후 UUID v4 형식이면 허용한다", () => {
        expect(
          validateRedirectPath(
            "/notes/%31%32%33e4567-e89b-42d3-a456-426614174000",
          ),
        ).toBe("/notes/123e4567-e89b-42d3-a456-426614174000");
      });

      it("/notes/%31%32%33e4567-e89b-12d3-a456-426614174000은 1회 decode 후 UUID version이 4가 아니므로 /mypage를 반환한다", () => {
        expect(
          validateRedirectPath(
            "/notes/%31%32%33e4567-e89b-12d3-a456-426614174000",
          ),
        ).toBe("/mypage");
      });

      it("/notes/%31%32%33e4567-e89b-42d3-c456-426614174000은 1회 decode 후 UUID variant가 유효하지 않으므로 /mypage를 반환한다", () => {
        expect(
          validateRedirectPath(
            "/notes/%31%32%33e4567-e89b-42d3-c456-426614174000",
          ),
        ).toBe("/mypage");
      });

      it("/notes%25abc는 위험하지 않은 percent 포함 — 정책에 따라 처리된다", () => {
        expect(validateRedirectPath("/notes%25abc")).toBe("/mypage");
      });
    });
    describe("decode 실패", () => {
      it("잘못된 percent-encoding이 포함된 경로는 /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%gg")).toBe("/mypage");
      });

      it("/notes/%는 invalid encoding → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%")).toBe("/mypage");
      });

      it("/notes/%E0%A4%A는 incomplete multibyte sequence → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%E0%A4%A")).toBe("/mypage");
      });

      it("/%E0%A4%A는 incomplete multibyte sequence → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/%E0%A4%A")).toBe("/mypage");
      });

      it("/notes/%4는 incomplete encoding → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%4")).toBe("/mypage");
      });

      it("/notes/%ZZ는 invalid hex digits → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%ZZ")).toBe("/mypage");
      });

      it("/notes/%1는 1자리 hex — incomplete encoding → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%1")).toBe("/mypage");
      });

      it("/notes/%C3%28는 invalid multibyte sequence (overlong) → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%C3%28")).toBe("/mypage");
      });

      it("디코딩 실패 시 throw 없이 항상 /mypage를 반환한다", () => {
        expect(() => validateRedirectPath("/notes/%E0%A4%A")).not.toThrow();
        expect(validateRedirectPath("/notes/%E0%A4%A")).toBe("/mypage");
      });
    });
    describe("double decode 금지", () => {
      it("/notes/%252Fapi는 double-encoded slash — 1회 decode 후 여전히 %2F 포함 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%252Fapi")).toBe("/mypage");
      });

      it("/notes/%255Capi는 double-encoded backslash — 1회 decode 후 여전히 %5C 포함 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%255Capi")).toBe("/mypage");
      });

      it("/notes/%252E%252E는 double-encoded dot — 1회 decode 후 여전히 %2E 포함 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%252E%252E")).toBe("/mypage");
      });

      it("1회 decode 결과 기준으로만 판정되고 double decode는 수행하지 않는다", () => {
        // %2541 → 1회 decode → %41 → 2회 decode → A
        // URL 디코딩은 1회만 수행되며, 디코딩 결과는 허용 경로 규칙(exact/dynamic match)을 통과해야만 반환된다
        expect(validateRedirectPath("/notes/%2541")).toBe("/mypage");
      });
    });
  });

  describe("4. 디코딩 후 재검사", () => {
    describe("제어 문자", () => {
      it("탭 문자가 포함된 경로는 /mypage를 반환한다", () => {
        expect(validateRedirectPath("/my\tpage")).toBe("/mypage");
      });

      it("개행 문자가 포함된 경로는 /mypage를 반환한다", () => {
        expect(validateRedirectPath("/my\npage")).toBe("/mypage");
      });

      it("디코딩 후 공백이 포함되는 경우 /mypage를 반환한다", () => {
        // %20 → 공백은 제어 문자로 간주하여 차단
        expect(validateRedirectPath("/notes/abc%20def")).toBe("/mypage");
      });
    });

    describe("path traversal", () => {
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

      it("/notes/%2E는 decode 후 . segment → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%2E")).toBe("/mypage");
      });

      it("/notes/%2E%2E는 decode 후 .. segment → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%2E%2E")).toBe("/mypage");
      });

      it("/notes/%2e%2e (소문자)는 decode 후 .. segment → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%2e%2e")).toBe("/mypage");
      });

      it("/notes/%2E%2e (대소문자 혼합)는 decode 후 .. segment → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%2E%2e")).toBe("/mypage");
      });

      it("/notes/.%2E (리터럴 dot + 인코딩 dot)는 decode 후 .. segment → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/.%2E")).toBe("/mypage");
      });

      it("디코딩 후 재검사 없으면 통과될 수 있는 케이스도 반드시 차단됨을 보장한다", () => {
        // %2E%2E → .. — 디코딩 후 path traversal이 드러남
        expect(validateRedirectPath("/%2E%2E/etc")).toBe("/mypage");
      });
    });

    describe("디코딩 후 드러나는 위험 패턴", () => {
      // slash/backslash
      // 경로 구조 깨지는 경우
      it("디코딩 후 슬래시가 포함되는 경우 /mypage를 반환한다", () => {
        // %2F → / — 디코딩 후 슬래시가 드러나 추가 segment처럼 동작함
        expect(validateRedirectPath("/notes/%2F123")).toBe("/mypage");
      });

      it("/notes/%2Fadmin은 decode 후 추가 segment 생성 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%2Fadmin")).toBe("/mypage");
      });

      it("/notes/%2F는 decode 후 빈 segment 생성 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%2F")).toBe("/mypage");
      });

      it("/notes/%2F%2F는 decode 후 다중 segment 생성 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%2F%2F")).toBe("/mypage");
      });

      it("/notes/%5Cabc는 decode 후 역슬래시 생성 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%5Cabc")).toBe("/mypage");
      });

      it("/notes/%2Fabc는 decode 후 /notes//abc — 빈 segment 포함 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%2Fabc")).toBe("/mypage");
      });

      it("/notes/%2Fabc%2Fdef는 decode 후 3개 segment 생성 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/%2Fabc%2Fdef")).toBe("/mypage");
      });

      it("/notes%2F123은 decode 후 /notes/123이 되어 /mypage을 반환한다", () => {
        expect(validateRedirectPath("/notes%2F123")).toBe("/mypage");
      });

      it("/notes%2Fnew%2Fextra는 decode 후 segment 2개 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes%2Fnew%2Fextra")).toBe("/mypage");
      });

      it("/notes%23frag는 decode 후 fragment 포함 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes%23frag")).toBe("/mypage");
      });
    });

    describe("디코딩 후 정책상 차단 경로", () => {
      it("/api%2Ftest는 decode 후 /api/test — api segment 차단 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/api%2Ftest")).toBe("/mypage");
      });

      it("/login%2Ftest는 decode 후 차단 경로 하위 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/login%2Ftest")).toBe("/mypage");
      });

      it("/signup%2Ftest는 decode 후 차단 경로 하위 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/signup%2Ftest")).toBe("/mypage");
      });

      it("/verify-email%2Ftest는 decode 후 차단 경로 하위 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/verify-email%2Ftest")).toBe("/mypage");
      });

      it("/privacy%2Ftest는 decode 후 차단 경로 하위 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/privacy%2Ftest")).toBe("/mypage");
      });

      it("/terms%2Ftest는 decode 후 차단 경로 하위 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/terms%2Ftest")).toBe("/mypage");
      });

      it("/api%2ftest (소문자 f)는 decode 후 /api/test → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/api%2ftest")).toBe("/mypage");
      });

      it("/api%2fTEST (소문자 f, 대문자 path)는 decode 후 /api/TEST → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/api%2fTEST")).toBe("/mypage");
      });
    });
  });

  describe("5. 허용 경로 판정", () => {
    describe("exact match", () => {
      it("/mypage는 /mypage를 반환한다", () => {
        expect(validateRedirectPath("/mypage")).toBe("/mypage");
      });

      it('" /mypage/extra " (앞뒤 공백)는 trim 후 invalid → /mypage를 반환한다', () => {
        expect(validateRedirectPath(" /mypage/extra ")).toBe("/mypage");
      });

      it("/notes는 /notes를 반환한다", () => {
        expect(validateRedirectPath("/notes")).toBe("/notes");
      });

      it("/notes/new는 /notes/new를 반환한다", () => {
        expect(validateRedirectPath("/notes/new")).toBe("/notes/new");
      });

      it('" /notes/new/edit " (앞뒤 공백)는 trim 후 extra segment → /mypage를 반환한다', () => {
        expect(validateRedirectPath(" /notes/new/edit ")).toBe("/mypage");
      });

      it("/notes-123은 /mypage을 반환한다", () => {
        expect(validateRedirectPath("/notes-123")).toBe("/mypage");
      });

      it("/api-test는 /mypage를 반환한다", () => {
        // 첫 번째 segment가 'api-test'이므로 api segment 차단 정책에 해당하지 않음
        expect(validateRedirectPath("/api-test")).toBe("/mypage");
      });

      it("/mypage/extra는 exact match 아님 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/mypage/extra")).toBe("/mypage");
      });

      it("/mypageX는 exact match 아님 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/mypageX")).toBe("/mypage");
      });

      it("/mypage-settings는 exact match 아님 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/mypage-settings")).toBe("/mypage");
      });

      it("/notes-old는 exact match 아님 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes-old")).toBe("/mypage");
      });

      it("/notes_new는 exact match 아님 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes_new")).toBe("/mypage");
      });

      it("/notes123는 exact match 아님 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes123")).toBe("/mypage");
      });

      it("/notes/new/edit는 extra segment — exact match 아님 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/new/edit")).toBe("/mypage");
      });

      it("/mypage/ (trailing slash)는 exact match 아님 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/mypage/")).toBe("/mypage");
      });

      it("/notes/new/ (trailing slash)는 exact match 아님 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/new/")).toBe("/mypage");
      });

      it("/mypage2는 exact match 아님 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/mypage2")).toBe("/mypage");
      });

      it("/notes-archive는 exact match 아님 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes-archive")).toBe("/mypage");
      });

      it("/noteshack는 prefix 오판 방지 — exact match 아님 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/noteshack")).toBe("/mypage");
      });

      it("/notes.new는 prefix 오판 방지 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes.new")).toBe("/mypage");
      });

      it("/notes-new는 prefix 오판 방지 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes-new")).toBe("/mypage");
      });

      it("/mypage-hack는 prefix 오판 방지 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/mypage-hack")).toBe("/mypage");
      });

      it("/notes_는 prefix 오판 방지 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes_")).toBe("/mypage");
      });

      it("/mypage-는 prefix 오판 방지 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/mypage-")).toBe("/mypage");
      });

      it("/notesX는 prefix 오판 방지 → /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notesX")).toBe("/mypage");
      });
    });

    describe("dynamic match: /notes/[noteId]", () => {
      describe("허용", () => {
        it("/notes/550e8400-e29b-41d4-a716-446655440000은 그대로 반환한다", () => {
          expect(
            validateRedirectPath("/notes/550e8400-e29b-41d4-a716-446655440000"),
          ).toBe("/notes/550e8400-e29b-41d4-a716-446655440000");
        });

        it("/notes/550e8400-e29b-41d4-a716-446655440000은 소문자 UUID이므로 그대로 반환한다", () => {
          expect(
            validateRedirectPath("/notes/550e8400-e29b-41d4-a716-446655440000"),
          ).toBe("/notes/550e8400-e29b-41d4-a716-446655440000");
        });

        it("/notes/550E8400-E29B-41D4-A716-446655440000은 대문자 UUID이므로 그대로 반환한다", () => {
          expect(
            validateRedirectPath("/notes/550E8400-E29B-41D4-A716-446655440000"),
          ).toBe("/notes/550E8400-E29B-41D4-A716-446655440000");
        });

        it("/notes/123E4567-E89B-42D3-A456-426614174000은 version/variant가 유효한 UUID이므로 그대로 반환한다", () => {
          expect(
            validateRedirectPath("/notes/123E4567-E89B-42D3-A456-426614174000"),
          ).toBe("/notes/123E4567-E89B-42D3-A456-426614174000");
        });

        it("/notes/123e4567-e89b-42d3-a456-426614174000은 유효한 UUID v4이므로 그대로 반환한다", () => {
          expect(
            validateRedirectPath("/notes/123e4567-e89b-42d3-a456-426614174000"),
          ).toBe("/notes/123e4567-e89b-42d3-a456-426614174000");
        });

        it("/notes/123E4567-E89B-42D3-A456-426614174000은 대문자 UUID v4이므로 그대로 반환한다", () => {
          expect(
            validateRedirectPath("/notes/123E4567-E89B-42D3-A456-426614174000"),
          ).toBe("/notes/123E4567-E89B-42D3-A456-426614174000");
        });

        it("/notes/123e4567-e89b-42d3-b456-426614174000은 variant가 유효한 UUID v4이므로 그대로 반환한다", () => {
          expect(
            validateRedirectPath("/notes/123e4567-e89b-42d3-b456-426614174000"),
          ).toBe("/notes/123e4567-e89b-42d3-b456-426614174000");
        });
      });

      describe("차단", () => {
        it("/notes/ (빈 segment)는 /mypage를 반환한다", () => {
          // noteId가 비어 있으면 유효하지 않은 경로
          expect(validateRedirectPath("/notes/")).toBe("/mypage");
        });

        it("/notes/123은 /mypage을 반환한다", () => {
          expect(validateRedirectPath("/notes/123")).toBe("/mypage");
        });

        it("/notes/123/edit (추가 segment)는 /mypage를 반환한다", () => {
          // 정확히 하나의 segment만 허용
          expect(validateRedirectPath("/notes/123/edit")).toBe("/mypage");
        });

        it('" /notes/123/ " (앞뒤 공백)는 trim 후 trailing slash → /mypage를 반환한다', () => {
          expect(validateRedirectPath(" /notes/123/ ")).toBe("/mypage");
        });

        it("/notes/. (path traversal)는 /mypage를 반환한다", () => {
          expect(validateRedirectPath("/notes/.")).toBe("/mypage");
        });

        it("/notes/.. (path traversal)는 /mypage를 반환한다", () => {
          expect(validateRedirectPath("/notes/..")).toBe("/mypage");
        });

        it("/notes//123 (이중 슬래시)는 /mypage를 반환한다", () => {
          expect(validateRedirectPath("/notes//123")).toBe("/mypage");
        });

        it("/notes/// (다중 슬래시)는 /mypage를 반환한다", () => {
          expect(validateRedirectPath("/notes///")).toBe("/mypage");
        });

        it("/notes/123/ (trailing slash)는 /mypage를 반환한다", () => {
          expect(validateRedirectPath("/notes/123/")).toBe("/mypage");
        });

        it("/notes// (이중 슬래시)는 /mypage를 반환한다", () => {
          expect(validateRedirectPath("/notes//")).toBe("/mypage");
        });

        it("/notes/0은 /mypage을 반환한다", () => {
          expect(validateRedirectPath("/notes/0")).toBe("/mypage");
        });

        it("/notes/id/ (trailing slash)는 /mypage를 반환한다", () => {
          expect(validateRedirectPath("/notes/id/")).toBe("/mypage");
        });

        it("/notes/550e8400-e29b-41d4-a716-44665544000은 UUID 길이 부족으로 /mypage를 반환한다", () => {
          expect(
            validateRedirectPath("/notes/550e8400-e29b-41d4-a716-44665544000"),
          ).toBe("/mypage");
        });

        it("/notes/550e8400-e29b-41d4-a716-4466554400000은 UUID 길이 초과로 /mypage를 반환한다", () => {
          expect(
            validateRedirectPath(
              "/notes/550e8400-e29b-41d4-a716-4466554400000",
            ),
          ).toBe("/mypage");
        });

        it("/notes/550e8400-e29b-41d4-a716-44665544zzzz는 UUID에 비hex 문자가 포함되어 /mypage를 반환한다", () => {
          expect(
            validateRedirectPath("/notes/550e8400-e29b-41d4-a716-44665544zzzz"),
          ).toBe("/mypage");
        });

        it("/notes/550e8400e29b41d4a716446655440000은 하이픈 없는 UUID이므로 /mypage를 반환한다", () => {
          expect(
            validateRedirectPath("/notes/550e8400e29b41d4a716446655440000"),
          ).toBe("/mypage");
        });

        it("/notes/{550e8400-e29b-41d4-a716-446655440000}은 brace 포함 UUID이므로 /mypage를 반환한다", () => {
          expect(
            validateRedirectPath(
              "/notes/{550e8400-e29b-41d4-a716-446655440000}",
            ),
          ).toBe("/mypage");
        });

        it("/notes/123e4567-e89b-12d3-a456-426614174000은 UUID version이 4가 아니므로 /mypage를 반환한다", () => {
          expect(
            validateRedirectPath("/notes/123e4567-e89b-12d3-a456-426614174000"),
          ).toBe("/mypage");
        });

        it("/notes/123e4567-e89b-42d3-c456-426614174000은 UUID variant가 유효하지 않으므로 /mypage를 반환한다", () => {
          expect(
            validateRedirectPath("/notes/123e4567-e89b-42d3-c456-426614174000"),
          ).toBe("/mypage");
        });
      });
    });
  });
});
