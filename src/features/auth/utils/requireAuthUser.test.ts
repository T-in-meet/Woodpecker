import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import { requireAuthUser } from "./requireAuthUser";

const hoisted = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: hoisted.redirectMock,
}));

vi.mock("@/lib/supabase/getUser", () => ({
  getUser: hoisted.getUserMock,
}));

describe("requireAuthUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("user가 있으면 redirect 하지 않는다", async () => {
    const user = { id: "user-id" };

    hoisted.getUserMock.mockResolvedValue(user);

    await expect(requireAuthUser()).resolves.toBeUndefined();

    expect(hoisted.redirectMock).not.toHaveBeenCalled();
  });

  it("user가 없으면 login으로 redirect 한다", async () => {
    hoisted.getUserMock.mockResolvedValue(null);

    hoisted.redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(requireAuthUser()).rejects.toThrow("NEXT_REDIRECT");

    expect(hoisted.redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
  });

  it("getUser가 실패하면 login으로 redirect 한다", async () => {
    hoisted.getUserMock.mockRejectedValue(new Error("GET_USER_FAILED"));

    hoisted.redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(requireAuthUser()).rejects.toThrow("NEXT_REDIRECT");

    expect(hoisted.redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
  });
});
