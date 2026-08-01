import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthUserMock = vi.hoisted(() => vi.fn());
const setPasswordBoundActionMock = vi.hoisted(() => vi.fn());
const setPasswordActionMock = vi.hoisted(() => {
  const action = vi.fn();
  action.bind = vi.fn(() => setPasswordBoundActionMock);
  return action;
});
const SetPasswordFormMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/utils/requireAuthUser", () => ({
  requireAuthUser: requireAuthUserMock,
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

describe("SetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("인증 사용자만 접근할 수 있도록 requireAuthUser를 호출한다", async () => {
    const element = await SetPasswordPage({
      searchParams: Promise.resolve({}),
    });

    render(element);

    expect(requireAuthUserMock).toHaveBeenCalledWith({
      redirectTo: ROUTES.SIGNUP,
    });
    expect(screen.getByTestId("set-password-form")).toBeInTheDocument();
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
