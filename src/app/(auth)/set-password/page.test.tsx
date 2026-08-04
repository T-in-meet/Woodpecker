import type { User } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());
const setPasswordBoundActionMock = vi.hoisted(() => vi.fn());
const setPasswordActionMock = vi.hoisted(() => {
  const action = vi.fn();
  action.bind = vi.fn(() => setPasswordBoundActionMock);
  return action;
});
const SetPasswordFormMock = vi.hoisted(() => vi.fn());
const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/supabase/getUser", () => ({
  getUser: getUserMock,
}));

vi.mock("@/features/auth/set-password/actions/setPasswordAction", () => ({
  setPasswordAction: setPasswordActionMock,
}));

vi.mock("@/features/auth/set-password/components/SetPasswordForm", async () => {
  const React = await import("react");

  return {
    SetPasswordForm: (props: { action: unknown }) => {
      SetPasswordFormMock(props);
      return React.createElement("div", {
        "data-testid": "set-password-form",
      });
    },
  };
});

import { ROUTES } from "@/lib/constants/routes";

import SetPasswordPage from "./page";

/**
 * set-password 페이지 테스트에 필요한 최소 Supabase User 객체를 생성합니다.
 *
 * @param providers app_metadata.providers에 넣을 provider 목록
 * @returns Supabase User 형태의 테스트 객체
 */
function makeUser(providers: string[]): User {
  return {
    app_metadata: { providers },
    aud: "authenticated",
    created_at: "2026-08-03T00:00:00.000Z",
    id: "user-id",
    user_metadata: {},
  } as User;
}

describe("SetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
    getUserMock.mockResolvedValue(makeUser(["google"]));
  });

  it("OAuth-only 사용자에게 비밀번호 설정 폼을 렌더링한다", async () => {
    const element = await SetPasswordPage({
      searchParams: Promise.resolve({}),
    });

    render(element);

    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("set-password-form")).toBeInTheDocument();
  });

  it("인증되지 않은 사용자는 signup으로 redirect한다", async () => {
    getUserMock.mockResolvedValue(null);

    await expect(
      SetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.SIGNUP);
    expect(setPasswordActionMock.bind).not.toHaveBeenCalled();
  });

  it("password provider가 있는 사용자는 mypage로 redirect한다", async () => {
    getUserMock.mockResolvedValue(makeUser(["google", "email"]));

    await expect(
      SetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.MYPAGE);
    expect(setPasswordActionMock.bind).not.toHaveBeenCalled();
  });

  it("redirect query를 Server Action에 bind한다", async () => {
    const element = await SetPasswordPage({
      searchParams: Promise.resolve({ redirect: "/notes" }),
    });

    render(element);

    expect(setPasswordActionMock.bind).toHaveBeenCalledWith(null, "/notes");
    expect(SetPasswordFormMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: setPasswordBoundActionMock,
      }),
    );
  });
});
