/**
 * supabase/server.ts createClient / createServerComponentClient 테스트
 *
 * 검증 범위:
 * - createClient: setAll에서 쿠키 쓰기 예외가 호출자에게 전파됨
 * - createServerComponentClient: setAll에서 쿠키 쓰기 예외를 무시함
 * - 두 클라이언트 모두 getAll은 cookieStore.getAll()을 그대로 반환
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAll, mockSet } = vi.hoisted(() => ({
  mockGetAll: vi.fn().mockReturnValue([{ name: "sb-token", value: "abc" }]),
  mockSet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: mockGetAll,
    set: mockSet,
  }),
}));

vi.mock("@supabase/ssr", () => ({
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
}));

import { createClient, createServerComponentClient } from "./server";

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (list: { name: string; value: string; options: object }[]) => void;
};

describe("createClient (Server Action / Route Handler용)", () => {
  beforeEach(() => {
    mockSet.mockReset();
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
    mockSet.mockReset();
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
