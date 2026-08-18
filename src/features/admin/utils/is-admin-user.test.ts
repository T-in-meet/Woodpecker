import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAdminClient } from "@/lib/supabase/admin";

import { isAdminUser } from "./is-admin-user";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";

type ProfileRole = "ADMIN" | "USER";

function createAdminClientMock({
  profile = {
    role: "ADMIN" as ProfileRole,
  },
  error = null,
}: {
  profile?: {
    role: ProfileRole;
  } | null;
  error?: Error | null;
} = {}) {
  const single = vi.fn().mockResolvedValue({
    data: profile,
    error,
  });

  const eq = vi.fn().mockReturnValue({
    single,
  });

  const select = vi.fn().mockReturnValue({
    eq,
  });

  const from = vi.fn().mockReturnValue({
    select,
  });

  return {
    client: {
      from,
    },
    eq,
    from,
    select,
    single,
  };
}

describe("isAdminUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("profile role이 ADMIN이면 true를 반환한다", async () => {
    const { client, eq, from, select, single } = createAdminClientMock();

    vi.mocked(createAdminClient).mockReturnValue(client as never);

    const result = await isAdminUser(USER_ID);

    expect(result).toBe(true);

    expect(createAdminClient).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("role");
    expect(eq).toHaveBeenCalledWith("id", USER_ID);
    expect(single).toHaveBeenCalledTimes(1);
  });

  it("profile role이 ADMIN이 아니면 false를 반환한다", async () => {
    const { client } = createAdminClientMock({
      profile: {
        role: "USER",
      },
    });

    vi.mocked(createAdminClient).mockReturnValue(client as never);

    const result = await isAdminUser(USER_ID);

    expect(result).toBe(false);
  });

  it("profile이 없으면 false를 반환한다", async () => {
    const { client } = createAdminClientMock({
      profile: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(client as never);

    const result = await isAdminUser(USER_ID);

    expect(result).toBe(false);
  });

  it("profile 조회에 실패하면 false를 반환한다", async () => {
    const error = new Error("profile load failed");

    const { client } = createAdminClientMock({
      profile: null,
      error,
    });

    vi.mocked(createAdminClient).mockReturnValue(client as never);

    const result = await isAdminUser(USER_ID);

    expect(result).toBe(false);
  });
});
