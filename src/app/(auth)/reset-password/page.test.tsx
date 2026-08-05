import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthUserMock = vi.hoisted(() => vi.fn());
const hasResetPasswordIntentCookieMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());
const resetPasswordBoundActionMock = vi.hoisted(() => vi.fn());
const resetPasswordActionMock = vi.hoisted(() => {
  const action = vi.fn();
  action.bind = vi.fn(() => resetPasswordBoundActionMock);
  return action;
});
const ResetPasswordFormMock = vi.hoisted(() => vi.fn());
const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/features/auth/utils/requireAuthUser", () => ({
  requireAuthUser: requireAuthUserMock,
}));

vi.mock("@/features/auth/lib/resetPasswordIntent", () => ({
  hasResetPasswordIntentCookie: hasResetPasswordIntentCookieMock,
}));

vi.mock("@/features/auth/reset-password/actions/resetPasswordAction", () => ({
  resetPasswordAction: resetPasswordActionMock,
}));

vi.mock(
  "@/features/auth/reset-password/components/ResetPasswordForm",
  async () => {
    const React = await import("react");

    return {
      ResetPasswordForm: (props: { action: unknown }) => {
        ResetPasswordFormMock(props);
        return React.createElement("div", {
          "data-testid": "reset-password-form",
        });
      },
    };
  },
);

import { ROUTES } from "@/lib/constants/routes";

import ResetPasswordPage from "./page";

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
    hasResetPasswordIntentCookieMock.mockResolvedValue(true);
  });

  it("인증 사용자와 reset intent cookie가 있으면 비밀번호 재설정 폼을 렌더링한다", async () => {
    const element = await ResetPasswordPage({
      searchParams: Promise.resolve({}),
    });

    render(element);

    expect(requireAuthUserMock).toHaveBeenCalledWith({
      redirectTo: ROUTES.FORGOT_PASSWORD,
    });
    expect(hasResetPasswordIntentCookieMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("reset-password-form")).toBeInTheDocument();
  });

  it("reset intent cookie가 없으면 forgot-password로 redirect한다", async () => {
    hasResetPasswordIntentCookieMock.mockResolvedValue(false);

    await expect(
      ResetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
    expect(resetPasswordActionMock.bind).not.toHaveBeenCalled();
  });

  it("redirect query를 Server Action에 bind한다", async () => {
    const element = await ResetPasswordPage({
      searchParams: Promise.resolve({ redirect: "/notes" }),
    });

    render(element);

    expect(resetPasswordActionMock.bind).toHaveBeenCalledWith(null, "/notes");
    expect(ResetPasswordFormMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: resetPasswordBoundActionMock,
      }),
    );
  });
});
