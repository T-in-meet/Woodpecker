import type { User } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.hoisted(() => vi.fn());
const getHasPasswordLoginMock = vi.hoisted(() => vi.fn());
const validateRedirectPathMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/features/auth/lib/getHasPasswordLogin", () => ({
  getHasPasswordLogin: getHasPasswordLoginMock,
}));

vi.mock("@/features/auth/lib/validateRedirectPath", () => ({
  validateRedirectPath: validateRedirectPathMock,
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
 */
function makeUser(): User {
  return {
    app_metadata: { providers: ["google"] },
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

    getUserMock.mockResolvedValue(makeUser());
    getHasPasswordLoginMock.mockResolvedValue(false);

    validateRedirectPathMock.mockImplementation((value: unknown) =>
      typeof value === "string" ? value : ROUTES.MYPAGE,
    );
  });

  it("비밀번호가 없는 인증 사용자에게 비밀번호 설정 폼을 렌더링한다", async () => {
    const element = await SetPasswordPage({
      searchParams: Promise.resolve({}),
    });

    render(element);

    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("user-id");
    expect(validateRedirectPathMock).not.toHaveBeenCalled();

    expect(setPasswordActionMock.bind).toHaveBeenCalledWith(null, null);
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
    expect(getHasPasswordLoginMock).not.toHaveBeenCalled();
    expect(validateRedirectPathMock).not.toHaveBeenCalled();
    expect(setPasswordActionMock.bind).not.toHaveBeenCalled();
  });

  it("이미 비밀번호가 있고 redirect가 없으면 mypage로 redirect한다", async () => {
    getHasPasswordLoginMock.mockResolvedValue(true);

    await expect(
      SetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("user-id");
    expect(validateRedirectPathMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.MYPAGE);
    expect(setPasswordActionMock.bind).not.toHaveBeenCalled();
  });

  it("이미 비밀번호가 있고 redirect가 있으면 검증된 redirect를 보존한다", async () => {
    getHasPasswordLoginMock.mockResolvedValue(true);
    validateRedirectPathMock.mockReturnValue("/notes");

    await expect(
      SetPasswordPage({
        searchParams: Promise.resolve({ redirect: "/notes" }),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(validateRedirectPathMock).toHaveBeenCalledWith("/notes");
    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("user-id");
    expect(redirectMock).toHaveBeenCalledWith("/notes");
    expect(setPasswordActionMock.bind).not.toHaveBeenCalled();
  });

  it("비밀번호가 없고 redirect가 있으면 검증된 redirect를 Server Action에 bind한다", async () => {
    validateRedirectPathMock.mockReturnValue("/notes");

    const element = await SetPasswordPage({
      searchParams: Promise.resolve({ redirect: "/notes" }),
    });

    render(element);

    expect(validateRedirectPathMock).toHaveBeenCalledWith("/notes");
    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("user-id");

    expect(setPasswordActionMock.bind).toHaveBeenCalledWith(null, "/notes");
    expect(SetPasswordFormMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: setPasswordBoundActionMock,
      }),
    );

    expect(screen.getByTestId("set-password-form")).toBeInTheDocument();
  });

  it("유효하지 않은 redirect는 검증 결과를 사용한다", async () => {
    validateRedirectPathMock.mockReturnValue(ROUTES.MYPAGE);

    const element = await SetPasswordPage({
      searchParams: Promise.resolve({
        redirect: "https://example.com",
      }),
    });

    render(element);

    expect(validateRedirectPathMock).toHaveBeenCalledWith(
      "https://example.com",
    );

    expect(setPasswordActionMock.bind).toHaveBeenCalledWith(
      null,
      ROUTES.MYPAGE,
    );

    expect(screen.getByTestId("set-password-form")).toBeInTheDocument();
  });
});
