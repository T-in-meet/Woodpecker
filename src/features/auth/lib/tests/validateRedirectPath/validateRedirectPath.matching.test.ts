import { describe, expect, it } from "vitest";

import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("validateRedirectPath 허용 경로 판정", () => {
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

    it.each(["/notes/today", "/note-chats"])(
      "%s는 허용된 서비스 경로이므로 그대로 반환한다",
      (path) => {
        expect(validateRedirectPath(path)).toBe(path);
      },
    );

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

    it("/notes_new는 exact match 아님 → /mypage를 반환한다", () => {
      expect(validateRedirectPath("/notes_new")).toBe("/mypage");
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

      it("/notes/123/ (trailing slash)는 /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/123/")).toBe("/mypage");
      });

      it("/notes/0은 /mypage을 반환한다", () => {
        expect(validateRedirectPath("/notes/0")).toBe("/mypage");
      });

      it("/notes/550e8400-e29b-41d4-a716-44665544000은 UUID 길이 부족으로 /mypage를 반환한다", () => {
        expect(
          validateRedirectPath("/notes/550e8400-e29b-41d4-a716-44665544000"),
        ).toBe("/mypage");
      });

      it("/notes/550e8400-e29b-41d4-a716-4466554400000은 UUID 길이 초과로 /mypage를 반환한다", () => {
        expect(
          validateRedirectPath("/notes/550e8400-e29b-41d4-a716-4466554400000"),
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
          validateRedirectPath("/notes/{550e8400-e29b-41d4-a716-446655440000}"),
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

      it("/notes/api는 UUID v4가 아닌 noteId이므로 /mypage를 반환한다", () => {
        expect(validateRedirectPath("/notes/api")).toBe("/mypage");
      });
    });
  });

  describe("복습 및 노트 챗봇 동적 경로", () => {
    it.each([`/notes/${UUID}/review`, `/note-chats/${UUID}`])(
      "%s는 그대로 반환한다",
      (path) => {
        expect(validateRedirectPath(path)).toBe(path);
      },
    );

    it.each([
      "/notes/not-a-uuid/review",
      "/note-chats/not-a-uuid",
      `/notes/${UUID}/review/extra`,
      `/note-chats/${UUID}/extra`,
    ])("%s는 /mypage로 fallback한다", (path) => {
      expect(validateRedirectPath(path)).toBe("/mypage");
    });
  });

  describe("허용된 화면 상태 쿼리", () => {
    it.each([
      ["/notes?page=3", "/notes?page=3"],
      ["/notes?q=react&page=2&view=cards", "/notes?q=react&page=2&view=cards"],
      ["/notes/today?page=2", "/notes/today?page=2"],
      ["/mypage?section=reviews", "/mypage?section=reviews"],
    ])("%s를 %s로 보존한다", (input, expected) => {
      expect(validateRedirectPath(input)).toBe(expected);
    });

    it.each([
      ["/mypage?foo=bar", "/mypage"],
      ["/notes?redirect=https%3A%2F%2Fevil.com", "/notes"],
      ["/notes?page=2&page=3", "/notes"],
      [`/notes/${UUID}?page=2`, `/notes/${UUID}`],
    ])("%s의 허용되지 않은 쿼리를 제거한다", (input, expected) => {
      expect(validateRedirectPath(input)).toBe(expected);
    });
  });
});
