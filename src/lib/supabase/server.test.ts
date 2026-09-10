/**
 * supabase/server.ts 테스트
 *
 * 검증 범위:
 * - createClient: setAll에서 쿠키 쓰기 예외가 호출자에게 전파됨
 * - createServerComponentClient: setAll에서 쿠키 쓰기 예외를 무시함
 * - 두 클라이언트 모두 getAll은 cookieStore.getAll()을 그대로 반환
 * - clearSupabaseAuthSessionCookies:
 *   현재 프로젝트의 Auth cookie와 chunk만 제거하고 다른 cookie는 유지함
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAll, mockSet } = vi.hoisted(() => ({
  mockGetAll: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: mockGetAll,
    set: mockSet,
  }),
}));

vi.mock("@supabase/ssr", async () => {
  const actual =
    await vi.importActual<typeof import("@supabase/ssr")>("@supabase/ssr");

  return {
    ...actual,
    createServerClient: vi.fn(
      (
        _url: string,
        _key: string,
        opts: {
          cookies: {
            getAll: () => { name: string; value: string }[];
            setAll: (
              list: { name: string; value: string; options: object }[],
            ) => void;
          };
        },
      ) => opts.cookies,
    ),
  };
});

import {
  clearSupabaseAuthSessionCookies,
  createClient,
  createServerComponentClient,
} from "./server";

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (list: { name: string; value: string; options: object }[]) => void;
};

describe("createClient (Server Action / Route Handler용)", () => {
  beforeEach(() => {
    mockGetAll.mockReset();
    mockSet.mockReset();

    mockGetAll.mockReturnValue([{ name: "sb-token", value: "abc" }]);
  });

  it("getAll은 cookieStore.getAll()을 반환한다", async () => {
    const adapter = (await createClient()) as unknown as CookieAdapter;

    expect(adapter.getAll()).toEqual([{ name: "sb-token", value: "abc" }]);
  });

  it("setAll에서 쿠키 쓰기 예외가 전파된다", async () => {
    mockSet.mockImplementation(() => {
      throw new Error(
        "Cookies can only be modified in a Server Action or Route Handler",
      );
    });

    const adapter = (await createClient()) as unknown as CookieAdapter;

    expect(() =>
      adapter.setAll([{ name: "sb-token", value: "xyz", options: {} }]),
    ).toThrow("Cookies can only be modified");
  });

  it("setAll 정상 동작 시 cookieStore.set을 호출한다", async () => {
    const adapter = (await createClient()) as unknown as CookieAdapter;

    adapter.setAll([{ name: "a", value: "1", options: { path: "/" } }]);

    expect(mockSet).toHaveBeenCalledWith("a", "1", { path: "/" });
  });
});

describe("createServerComponentClient (Server Component용)", () => {
  beforeEach(() => {
    mockGetAll.mockReset();
    mockSet.mockReset();

    mockGetAll.mockReturnValue([{ name: "sb-token", value: "abc" }]);
  });

  it("getAll은 cookieStore.getAll()을 반환한다", async () => {
    const adapter =
      (await createServerComponentClient()) as unknown as CookieAdapter;

    expect(adapter.getAll()).toEqual([{ name: "sb-token", value: "abc" }]);
  });

  it("setAll에서 쿠키 쓰기 예외를 무시한다 (RSC 방어)", async () => {
    mockSet.mockImplementation(() => {
      throw new Error(
        "Cookies can only be modified in a Server Action or Route Handler",
      );
    });

    const adapter =
      (await createServerComponentClient()) as unknown as CookieAdapter;

    expect(() =>
      adapter.setAll([{ name: "sb-token", value: "xyz", options: {} }]),
    ).not.toThrow();
  });

  it("setAll 정상 동작 시 cookieStore.set을 호출한다", async () => {
    const adapter =
      (await createServerComponentClient()) as unknown as CookieAdapter;

    adapter.setAll([{ name: "a", value: "1", options: { path: "/" } }]);

    expect(mockSet).toHaveBeenCalledWith("a", "1", { path: "/" });
  });
});

describe("clearSupabaseAuthSessionCookies", () => {
  beforeEach(() => {
    mockGetAll.mockReset();
    mockSet.mockReset();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project-ref.supabase.co";
  });

  it("현재 프로젝트의 Auth session cookie를 만료시킨다", async () => {
    mockGetAll.mockReturnValue([
      {
        name: "sb-project-ref-auth-token",
        value: "session",
      },
      {
        name: "oauth_agreement_intent",
        value: "accepted",
      },
    ]);

    await clearSupabaseAuthSessionCookies();

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      "sb-project-ref-auth-token",
      "",
      expect.objectContaining({
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        maxAge: 0,
      }),
    );
  });

  it("chunk로 분리된 Auth session cookie를 모두 만료시킨다", async () => {
    mockGetAll.mockReturnValue([
      {
        name: "sb-project-ref-auth-token.0",
        value: "session-part-0",
      },
      {
        name: "sb-project-ref-auth-token.1",
        value: "session-part-1",
      },
    ]);

    await clearSupabaseAuthSessionCookies();

    expect(mockSet).toHaveBeenCalledTimes(2);

    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      "sb-project-ref-auth-token.0",
      "",
      expect.objectContaining({
        maxAge: 0,
      }),
    );

    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      "sb-project-ref-auth-token.1",
      "",
      expect.objectContaining({
        maxAge: 0,
      }),
    );
  });

  it("다른 프로젝트의 Auth cookie와 일반 cookie는 제거하지 않는다", async () => {
    mockGetAll.mockReturnValue([
      {
        name: "sb-other-project-auth-token",
        value: "other-session",
      },
      {
        name: "sb-other-project-auth-token.0",
        value: "other-session-part",
      },
      {
        name: "oauth_agreement_intent",
        value: "accepted",
      },
      {
        name: "service-cookie",
        value: "value",
      },
    ]);

    await clearSupabaseAuthSessionCookies();

    expect(mockSet).not.toHaveBeenCalled();
  });
});
