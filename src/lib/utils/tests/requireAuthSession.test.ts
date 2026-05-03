import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import { requireAuthSession } from "../requireAuthSession";

const hoisted = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: hoisted.redirectMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getSession: hoisted.getSessionMock,
    },
  }),
}));

describe("requireAuthSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("session이 있으면 session을 반환하고 redirect 하지 않는다", async () => {
    const session = { user: { id: "user-id" } };

    hoisted.getSessionMock.mockResolvedValue({
      data: { session },
    });

    await expect(requireAuthSession()).resolves.toBe(session);
    expect(hoisted.redirectMock).not.toHaveBeenCalled();
  });

  it("session이 없으면 login으로 redirect 한다", async () => {
    hoisted.getSessionMock.mockResolvedValue({
      data: { session: null },
    });

    hoisted.redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(requireAuthSession()).rejects.toThrow("NEXT_REDIRECT");

    expect(hoisted.redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
  });
});
