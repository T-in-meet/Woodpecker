import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.hoisted(() => vi.fn());
const readSignedResetPasswordIntentMock = vi.hoisted(() => vi.fn());
const verifyResetPasswordIntentMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/lib/supabase/getUser", () => ({
  getUser: getUserMock,
}));

vi.mock("@/features/auth/lib/signedResetPasswordIntent", () => ({
  readSignedResetPasswordIntent: readSignedResetPasswordIntentMock,
  verifyResetPasswordIntent: verifyResetPasswordIntentMock,
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

const AUTHENTICATED_USER = {
  id: "user-id",
};

const SIGNED_RESET_PASSWORD_INTENT = "signed-reset-password-intent";

const VERIFIED_RESET_PASSWORD_INTENT = {
  purpose: "reset-password",
  userId: AUTHENTICATED_USER.id,
  issuedAt: 1_000,
  expiresAt: 1_900,
};

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });

    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    readSignedResetPasswordIntentMock.mockResolvedValue(
      SIGNED_RESET_PASSWORD_INTENT,
    );
    verifyResetPasswordIntentMock.mockReturnValue(
      VERIFIED_RESET_PASSWORD_INTENT,
    );
  });

  it("인증 사용자와 유효한 signed reset intent가 있으면 비밀번호 재설정 폼을 렌더링한다", async () => {
    const element = await ResetPasswordPage({
      searchParams: Promise.resolve({}),
    });

    render(element);

    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(readSignedResetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifyResetPasswordIntentMock).toHaveBeenCalledWith({
      token: SIGNED_RESET_PASSWORD_INTENT,
      expectedUserId: AUTHENTICATED_USER.id,
    });
    expect(resetPasswordActionMock.bind).toHaveBeenCalledWith(null, null);
    expect(screen.getByTestId("reset-password-form")).toBeInTheDocument();
  });

  it("인증 사용자가 없으면 signed intent를 읽지 않고 forgot-password로 redirect한다", async () => {
    getUserMock.mockResolvedValue(null);

    await expect(
      ResetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
    expect(readSignedResetPasswordIntentMock).not.toHaveBeenCalled();
    expect(verifyResetPasswordIntentMock).not.toHaveBeenCalled();
    expect(resetPasswordActionMock.bind).not.toHaveBeenCalled();
    expect(ResetPasswordFormMock).not.toHaveBeenCalled();
  });

  it("signed reset intent가 없으면 verifier를 호출하지 않고 forgot-password로 redirect한다", async () => {
    readSignedResetPasswordIntentMock.mockResolvedValue(null);

    await expect(
      ResetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(readSignedResetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifyResetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
    expect(resetPasswordActionMock.bind).not.toHaveBeenCalled();
    expect(ResetPasswordFormMock).not.toHaveBeenCalled();
  });

  it("signed reset intent 검증이 실패하면 forgot-password로 redirect한다", async () => {
    verifyResetPasswordIntentMock.mockReturnValue(null);

    await expect(
      ResetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(verifyResetPasswordIntentMock).toHaveBeenCalledWith({
      token: SIGNED_RESET_PASSWORD_INTENT,
      expectedUserId: AUTHENTICATED_USER.id,
    });
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
    expect(resetPasswordActionMock.bind).not.toHaveBeenCalled();
    expect(ResetPasswordFormMock).not.toHaveBeenCalled();
  });

  it("legacy verified 값은 authorization proof로 허용하지 않는다", async () => {
    readSignedResetPasswordIntentMock.mockResolvedValue("verified");
    verifyResetPasswordIntentMock.mockReturnValue(null);

    await expect(
      ResetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(verifyResetPasswordIntentMock).toHaveBeenCalledWith({
      token: "verified",
      expectedUserId: AUTHENTICATED_USER.id,
    });
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
    expect(resetPasswordActionMock.bind).not.toHaveBeenCalled();
    expect(ResetPasswordFormMock).not.toHaveBeenCalled();
  });

  it("verifier configuration error는 invalid intent redirect로 숨기지 않는다", async () => {
    const verificationError = new Error(
      "PASSWORD_INTENT_SIGNING_SECRET is not configured",
    );

    verifyResetPasswordIntentMock.mockImplementation(() => {
      throw verificationError;
    });

    await expect(
      ResetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(verificationError);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(resetPasswordActionMock.bind).not.toHaveBeenCalled();
    expect(ResetPasswordFormMock).not.toHaveBeenCalled();
  });

  it("signed authorization 성공 후 redirect query를 Server Action에 bind한다", async () => {
    const element = await ResetPasswordPage({
      searchParams: Promise.resolve({ redirect: "/notes" }),
    });

    render(element);

    expect(verifyResetPasswordIntentMock).toHaveBeenCalledWith({
      token: SIGNED_RESET_PASSWORD_INTENT,
      expectedUserId: AUTHENTICATED_USER.id,
    });
    expect(resetPasswordActionMock.bind).toHaveBeenCalledWith(null, "/notes");
    expect(ResetPasswordFormMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: resetPasswordBoundActionMock,
      }),
    );
  });
});
