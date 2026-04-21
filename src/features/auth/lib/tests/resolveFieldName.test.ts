import { describe, expect, it } from "vitest";

import {
  LOGIN_FIELD_NAMES,
  SIGNUP_FIELD_NAMES,
} from "@/features/auth/lib/resolveFieldName";
import { resolveFieldName } from "@/features/auth/lib/resolveFieldName";

/**
 * login 필드 집합 — 테스트에서 resolveFieldName의 generic 동작을 검증하기 위해 사용
 */
const loginFieldSet = new Set(LOGIN_FIELD_NAMES);

/**
 * signup 필드 집합 — 기존 동작 회귀 검증 및 generic 동작 확인을 위해 사용
 */
const signupFieldSet = new Set(SIGNUP_FIELD_NAMES);

describe("resolveFieldName — generic 필드 이름 매핑", () => {
  describe("login 필드 집합에서의 동작", () => {
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

  describe("signup 필드 집합에서의 동작 — 기존 회귀 검증", () => {
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
      // 서버가 중첩 경로로 내려주는 필드를 마지막 segment로 매핑하기 위함
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
      // 폼에서 처리할 수 없는 필드는 null로 반환하여 무시한다
      expect(resolveFieldName("agreements.unknown", signupFieldSet)).toBeNull();
    });
  });

  describe("공통 동작 — 입력 필드가 존재하지 않는 경우", () => {
    it("빈 문자열 필드는 어느 집합에서도 null을 반환한다", () => {
      expect(resolveFieldName("", loginFieldSet)).toBeNull();
      expect(resolveFieldName("", signupFieldSet)).toBeNull();
    });

    it("중첩 경로 마지막 segment가 필드 집합에 없으면 null을 반환한다", () => {
      expect(resolveFieldName("a.b.c.unknown", loginFieldSet)).toBeNull();
    });

    it("중첩 경로 마지막 segment가 필드 집합에 있으면 해당 필드를 반환한다", () => {
      // 깊이와 관계없이 마지막 segment만 기준으로 삼는다
      expect(resolveFieldName("a.b.c.email", loginFieldSet)).toBe("email");
    });
  });
});
