import { beforeEach, describe, expect, it, vi } from "vitest";

import { RESET_REQUIRED_COOKIE_NAME } from "@/features/auth/constants/cookies";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: cookieGetMock,
  })),
}));

import ResetPasswordPage from "../page";

const getSessionMock = vi.fn();

describe("reset-password page guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: { getSession: getSessionMock },
    } as never);

    getSessionMock.mockResolvedValue({ data: { session: {} } });
    cookieGetMock.mockReturnValue({
      name: RESET_REQUIRED_COOKIE_NAME,
      value: "true",
    });
  });

  it("TC1: session+cookie 존재 시 페이지 렌더를 허용한다", async () => {
    const result = await ResetPasswordPage();

    expect(cookieGetMock).toHaveBeenCalledWith(RESET_REQUIRED_COOKIE_NAME);
    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  it("TC2: session 없음이면 forgot-password로 redirect한다", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });

    await expect(ResetPasswordPage()).rejects.toBe(REDIRECT_ERROR);
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
  });

  it("TC3: cookie 없음이면 forgot-password로 redirect한다", async () => {
    cookieGetMock.mockReturnValueOnce(undefined);

    await expect(ResetPasswordPage()).rejects.toBe(REDIRECT_ERROR);
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
  });

  it("TC4: session 없음+cookie 없음이면 forgot-password로 redirect한다", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });
    cookieGetMock.mockReturnValueOnce(undefined);

    await expect(ResetPasswordPage()).rejects.toBe(REDIRECT_ERROR);
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
  });
});
