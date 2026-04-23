import { describe, expect, it } from "vitest";

import {
  LOGIN_FIELD_NAMES,
  SIGNUP_FIELD_NAMES,
} from "@/features/auth/lib/resolveFieldName";
import { resolveFieldName } from "@/features/auth/lib/resolveFieldName";

const loginFieldSet = new Set(LOGIN_FIELD_NAMES);
const signupFieldSet = new Set(SIGNUP_FIELD_NAMES);

describe("resolveFieldName", () => {
  describe("login 필드 집합", () => {
    it("email 필드는 그대로 email을 반환한다", () => {
      expect(resolveFieldName("email", loginFieldSet)).toBe("email");
    });

    it("password 필드는 그대로 password를 반환한다", () => {
      expect(resolveFieldName("password", loginFieldSet)).toBe("password");
    });

    it("login 필드에 없는 nickname은 null을 반환한다", () => {
      expect(resolveFieldName("nickname", loginFieldSet)).toBeNull();
    });

    it("login 필드에 없는 unknown 필드는 null을 반환한다", () => {
      expect(resolveFieldName("unknown", loginFieldSet)).toBeNull();
    });
  });

  describe("signup 필드 집합", () => {
    it("email 필드는 그대로 email을 반환한다", () => {
      expect(resolveFieldName("email", signupFieldSet)).toBe("email");
    });

    it("password 필드는 그대로 password를 반환한다", () => {
      expect(resolveFieldName("password", signupFieldSet)).toBe("password");
    });

    it("nickname 필드는 그대로 nickname을 반환한다", () => {
      expect(resolveFieldName("nickname", signupFieldSet)).toBe("nickname");
    });

    it("중첩 필드 agreements.termsOfService는 termsOfService를 반환한다", () => {
      expect(
        resolveFieldName("agreements.termsOfService", signupFieldSet),
      ).toBe("termsOfService");
    });

    it("중첩 필드 agreements.privacyPolicy는 privacyPolicy를 반환한다", () => {
      expect(resolveFieldName("agreements.privacyPolicy", signupFieldSet)).toBe(
        "privacyPolicy",
      );
    });

    it("중첩 필드의 마지막 segment가 필드 집합에 없으면 null을 반환한다", () => {
      expect(resolveFieldName("agreements.unknown", signupFieldSet)).toBeNull();
    });
  });

  describe("공통 동작 — dot path 경계", () => {
    it('".."는 빈 segment만 존재하므로 null을 반환한다', () => {
      expect(resolveFieldName("..", loginFieldSet)).toBeNull();
      expect(resolveFieldName("..", signupFieldSet)).toBeNull();
    });

    it('"email."는 마지막 segment가 비어 있으므로 null을 반환한다', () => {
      expect(resolveFieldName("email.", loginFieldSet)).toBeNull();
      expect(resolveFieldName("email.", signupFieldSet)).toBeNull();
    });

    it('".email"는 선행 빈 segment가 있으므로 null을 반환한다', () => {
      expect(resolveFieldName(".email", loginFieldSet)).toBeNull();
      expect(resolveFieldName(".email", signupFieldSet)).toBeNull();
    });

    it('"a..email"는 중간에 빈 segment가 있으므로 null을 반환한다', () => {
      expect(resolveFieldName("a..email", loginFieldSet)).toBeNull();
      expect(resolveFieldName("a..email", signupFieldSet)).toBeNull();
    });

    it('"a.b."는 마지막 segment가 비어 있으므로 null을 반환한다', () => {
      expect(resolveFieldName("a.b.", loginFieldSet)).toBeNull();
      expect(resolveFieldName("a.b.", signupFieldSet)).toBeNull();
    });

    it('"..email"는 빈 segment를 포함하므로 null을 반환한다', () => {
      expect(resolveFieldName("..email", loginFieldSet)).toBeNull();
      expect(resolveFieldName("..email", signupFieldSet)).toBeNull();
    });

    it('"a..b..email"는 다중 빈 segment를 포함하므로 null을 반환한다', () => {
      expect(resolveFieldName("a..b..email", loginFieldSet)).toBeNull();
      expect(resolveFieldName("a..b..email", signupFieldSet)).toBeNull();
    });

    it("공백만 있는 마지막 segment는 null을 반환한다", () => {
      expect(resolveFieldName("a.b.   ", loginFieldSet)).toBeNull();
      expect(resolveFieldName("a.b.   ", signupFieldSet)).toBeNull();
    });
  });

  describe("공통 동작 — 마지막 segment 규칙", () => {
    it("중첩 경로 마지막 segment가 필드 집합에 없으면 null을 반환한다", () => {
      expect(resolveFieldName("a.b.c.unknown", loginFieldSet)).toBeNull();
    });

    it("중첩 경로 마지막 segment가 필드 집합에 있으면 해당 필드를 반환한다", () => {
      expect(resolveFieldName("a.b.c.email", loginFieldSet)).toBe("email");
    });

    it('"email.invalid"는 마지막 segment가 유효하지 않으므로 null을 반환한다', () => {
      expect(resolveFieldName("email.invalid", loginFieldSet)).toBeNull();
    });

    it('"agreements.password.invalid"는 마지막 segment가 유효하지 않으므로 null을 반환한다', () => {
      expect(
        resolveFieldName("agreements.password.invalid", signupFieldSet),
      ).toBeNull();
    });

    it("유효 필드명을 포함하더라도 마지막 segment가 정확히 일치하지 않으면 null을 반환한다", () => {
      expect(resolveFieldName("profile.user-email", loginFieldSet)).toBeNull();
      expect(
        resolveFieldName("agreements.nicknameSuffix", signupFieldSet),
      ).toBeNull();
    });
  });

  describe("공통 동작 — generic set 의존성", () => {
    it("같은 마지막 segment라도 set에 따라 결과가 달라진다", () => {
      expect(resolveFieldName("profile.nickname", loginFieldSet)).toBeNull();
      expect(resolveFieldName("profile.nickname", signupFieldSet)).toBe(
        "nickname",
      );
    });

    it("깊은 중첩 경로도 마지막 segment의 set membership만으로 판정한다", () => {
      expect(resolveFieldName("a.b.c.nickname", loginFieldSet)).toBeNull();
      expect(resolveFieldName("a.b.c.nickname", signupFieldSet)).toBe(
        "nickname",
      );
    });
  });
});
