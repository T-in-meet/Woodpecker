import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { requireAdmin } from "./require-admin";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

describe("requireAdmin", () => {
  const getUser = vi.fn();
  const single = vi.fn();
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser,
      },
    } as never);

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as never);
  });

  it("로그인하지 않은 사용자는 UnauthorizedError를 발생시킨다", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("프로필 조회에 실패하면 ForbiddenError를 발생시킨다", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-id",
        },
      },
      error: null,
    });

    single.mockResolvedValue({
      data: null,
      error: new Error("db error"),
    });

    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("관리자가 아니면 ForbiddenError를 발생시킨다", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-id",
        },
      },
      error: null,
    });

    single.mockResolvedValue({
      data: {
        role: "USER",
      },
      error: null,
    });

    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("관리자이면 사용자 ID를 반환한다", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "admin-id",
        },
      },
      error: null,
    });

    single.mockResolvedValue({
      data: {
        role: "ADMIN",
      },
      error: null,
    });

    await expect(requireAdmin()).resolves.toBe("admin-id");
  });

  it("인증 조회 중 오류가 발생하면 UnauthorizedError를 발생시킨다", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("auth error"),
    });

    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
