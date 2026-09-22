import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthProviders } from "@/features/auth/lib/authProviders";
import { createAdminClient } from "@/lib/supabase/admin";

import { getUserByEmail, GetUserByEmailError } from "../getUserByEmail";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  getUserById: vi.fn(),
  getAuthProviders: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mocks.maybeSingle,
        })),
      })),
    })),
    auth: {
      admin: {
        getUserById: mocks.getUserById,
      },
    },
  })),
}));

vi.mock("@/features/auth/lib/authProviders", () => ({
  getAuthProviders: mocks.getAuthProviders,
}));

describe("getUserByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthProviders.mockReturnValue(["email"]);
  });

  it("profiles 조회 실패를 profile_lookup typed error로 변환하고 원본 오류를 보존한다", async () => {
    const cause = new Error("profiles lookup failed");
    mocks.maybeSingle.mockResolvedValue({ data: null, error: cause });

    let caught: unknown;

    try {
      await getUserByEmail("user@example.com");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(GetUserByEmailError);
    expect(caught).toMatchObject({
      kind: "profile_lookup",
      cause,
      message: "profiles lookup failed",
    });
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("profiles 조회 Promise rejection도 profile_lookup typed error로 변환하고 원본 오류를 보존한다", async () => {
    const cause = new Error("profiles lookup rejected");
    mocks.maybeSingle.mockRejectedValue(cause);

    let caught: unknown;

    try {
      await getUserByEmail("user@example.com");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(GetUserByEmailError);
    expect(caught).toMatchObject({
      kind: "profile_lookup",
      cause,
      message: "profiles lookup rejected",
    });
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("profile 존재 후 Auth Admin 조회 실패를 auth_user_lookup typed error로 변환하고 원본 오류를 보존한다", async () => {
    const cause = new Error("auth user lookup failed");
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "user-id" },
      error: null,
    });
    mocks.getUserById.mockResolvedValue({
      data: { user: null },
      error: cause,
    });

    let caught: unknown;

    try {
      await getUserByEmail("user@example.com");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(GetUserByEmailError);
    expect(caught).toMatchObject({
      kind: "auth_user_lookup",
      cause,
      message: "auth user lookup failed",
    });
    expect(mocks.getUserById).toHaveBeenCalledWith("user-id");
  });

  it("profile 존재 후 Auth Admin 조회 Promise rejection도 auth_user_lookup typed error로 변환하고 원본 오류를 보존한다", async () => {
    const cause = new Error("auth user lookup rejected");
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "user-id" },
      error: null,
    });
    mocks.getUserById.mockRejectedValue(cause);

    let caught: unknown;

    try {
      await getUserByEmail("user@example.com");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(GetUserByEmailError);
    expect(caught).toMatchObject({
      kind: "auth_user_lookup",
      cause,
      message: "auth user lookup rejected",
    });
    expect(mocks.getUserById).toHaveBeenCalledWith("user-id");
  });

  it("profile이 없으면 기존처럼 null을 반환한다", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(getUserByEmail("missing@example.com")).resolves.toBeNull();
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("existing user 조회가 성공하면 기존 payload를 반환한다", async () => {
    const authUser = {
      id: "user-id",
      email: "Stored@Example.com",
      email_confirmed_at: "2026-09-20T00:00:00.000Z",
    };
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "user-id" },
      error: null,
    });
    mocks.getUserById.mockResolvedValue({
      data: { user: authUser },
      error: null,
    });
    mocks.getAuthProviders.mockReturnValue(["email", "google"]);

    await expect(getUserByEmail("stored@example.com")).resolves.toEqual({
      id: "user-id",
      email: "Stored@Example.com",
      email_confirmed_at: "2026-09-20T00:00:00.000Z",
      auth_providers: ["email", "google"],
    });
    expect(getAuthProviders).toHaveBeenCalledWith(authUser);
    expect(createAdminClient).toHaveBeenCalledTimes(1);
  });
});
