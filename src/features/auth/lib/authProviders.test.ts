import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { getAuthProviders, hasPasswordLogin } from "./authProviders";

/**
 * provider 판정 테스트에 필요한 최소 Supabase User 객체를 생성합니다.
 *
 * @param overrides 테스트별로 덮어쓸 사용자 필드
 * @returns Supabase User 형태의 테스트 객체
 */
function makeUser(overrides: Partial<User>): User {
  return {
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-08-03T00:00:00.000Z",
    id: "user-id",
    user_metadata: {},
    ...overrides,
  } as User;
}

describe("authProviders", () => {
  it("app_metadata.providers 문자열 배열에서 provider 목록을 추출한다", () => {
    const user = makeUser({
      app_metadata: {
        providers: ["google", "email", 1],
      },
    } as Partial<User>);

    expect(getAuthProviders(user)).toEqual(["google", "email"]);
  });

  it("app_metadata.provider 단일 문자열을 provider 목록에 포함한다", () => {
    const user = makeUser({
      app_metadata: {
        provider: "google",
      },
    });

    expect(getAuthProviders(user)).toEqual(["google"]);
  });

  it("identities provider를 provider 목록에 포함한다", () => {
    const user = makeUser({
      identities: [
        {
          provider: "google",
        },
      ],
    } as Partial<User>);

    expect(getAuthProviders(user)).toEqual(["google"]);
  });

  it("email provider가 있으면 password login 보유로 판단한다", () => {
    const user = makeUser({
      app_metadata: {
        providers: ["google", "email"],
      },
    });

    expect(hasPasswordLogin(user)).toBe(true);
  });

  it("email provider가 없으면 password login 미보유로 판단한다", () => {
    const user = makeUser({
      app_metadata: {
        providers: ["google"],
      },
    });

    expect(hasPasswordLogin(user)).toBe(false);
  });
});
