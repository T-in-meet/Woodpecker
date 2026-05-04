import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import { requireGuestPage } from "./requireGuestPage";

// hoist
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

describe("requireGuestPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("session이 없으면 redirect 하지 않는다", async () => {
    hoisted.getSessionMock.mockResolvedValue({
      data: { session: null },
    });

    await requireGuestPage();

    expect(hoisted.redirectMock).not.toHaveBeenCalled();
  });

  it("session이 있으면 mypage로 redirect 한다", async () => {
    hoisted.getSessionMock.mockResolvedValue({
      data: { session: { user: { id: "1" } } },
    });

    // redirect는 throw로 처리하는 게 일반적이지만
    // 여기서는 호출 여부만 검증
    hoisted.redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(requireGuestPage()).rejects.toThrow();

    expect(hoisted.redirectMock).toHaveBeenCalledWith(ROUTES.MYPAGE);
  });
});
