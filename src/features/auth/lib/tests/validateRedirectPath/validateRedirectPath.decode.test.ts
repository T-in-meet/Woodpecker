import { describe, expect, it } from "vitest";

import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";

describe("validateRedirectPath 1회 디코딩", () => {
  describe("1회 decode 후 최종 판정", () => {
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

    it("/%E0%A4%A는 incomplete multibyte sequence → /mypage를 반환한다", () => {
      expect(validateRedirectPath("/%E0%A4%A")).toBe("/mypage");
    });

    it("/notes/%4는 incomplete encoding → /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/%4")).toBe("/mypage");
    });

    it("/notes/%C3%28는 invalid multibyte sequence (overlong) → /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/%C3%28")).toBe("/mypage");
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

    it("/notes/%2523frag는 1회 decode 후 %23가 남아도 추가 decode 없이 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/%2523frag")).toBe("/mypage");
    });

    it("/notes/%253Fq%3D1는 1회 decode 기준으로만 판정되어 /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes/%253Fq%3D1")).toBe("/mypage");
    });
  });
});
