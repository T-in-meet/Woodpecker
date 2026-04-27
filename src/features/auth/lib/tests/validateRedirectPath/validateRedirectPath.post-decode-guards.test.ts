import { describe, expect, it } from "vitest";

import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";

describe("validateRedirectPath 디코딩 후 재검사", () => {
  describe("제어 문자", () => {
    it("탭 문자가 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/my\tpage")).toBe("/mypage");
    });

    it("개행 문자가 포함된 경로는 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/my\npage")).toBe("/mypage");
    });

    it("인코딩된 공백이 포함된 경로는 /mypage를 반환한다", () => {
      // %20은 공백으로 해석되며, 공백 문자는 위험 패턴으로 차단한다
      expect(validateRedirectPath("/notes/abc%20def")).toBe("/mypage");
    });

    it("/notes/%09abc는 decode 후 탭 문자가 생성되어 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/%09abc")).toBe("/mypage");
    });

    it("/notes/%0Aabc는 decode 후 개행 문자가 생성되어 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/%0Aabc")).toBe("/mypage");
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

    it("/notes%3F는 decode 후 query 포함 → /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes%3F")).toBe("/mypage");
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
