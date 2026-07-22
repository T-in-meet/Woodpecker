import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OAuthButtons } from "@/features/auth/components/OAuthButtons";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/utils/showToast";

const signInWithOAuthMock = vi.fn();

// OAuth redirect를 실제로 시작하지 않고 Supabase 호출 인자만 검증한다.
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOAuth: signInWithOAuthMock,
    },
  })),
}));

vi.mock("@/lib/utils/showToast", () => ({
  showToast: vi.fn(),
}));

describe("OAuthButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithOAuthMock.mockResolvedValue({ error: null });
  });

  it("로그인 모드에서 OAuth provider 버튼을 렌더링한다", () => {
    render(<OAuthButtons mode="login" />);

    expect(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    ).toBeInTheDocument();
    const googleButton = screen.getByRole("button", {
      name: "Google 계정으로 계속하기",
    });
    const logo = googleButton.querySelector("img");

    // 로고는 시각 장식이며 버튼 이름에는 포함되지 않아야 한다.
    expect(logo).toHaveAttribute("src", "/images/logos/google.webp");
    expect(logo).toHaveAttribute("aria-hidden", "true");
  });

  it("회원가입 모드에서 OAuth provider 버튼을 렌더링한다", () => {
    render(<OAuthButtons mode="signup" />);

    expect(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    ).toBeInTheDocument();
  });

  it("provider와 Supabase callback redirect URL로 OAuth 로그인을 시작한다", async () => {
    const user = userEvent.setup();
    render(<OAuthButtons mode="login" />);

    await user.click(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    );

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: expect.stringContaining("/api/auth/callback"),
        },
      });
    });

    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("redirect prop을 callback URL query로 유지한다", async () => {
    const user = userEvent.setup();
    render(<OAuthButtons mode="login" redirect="/notes/today" />);

    await user.click(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    );

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledTimes(1);
    });

    const [oauthOptions] = signInWithOAuthMock.mock.calls[0]!;
    const redirectTo = oauthOptions.options.redirectTo as string;
    const callbackUrl = new URL(redirectTo);

    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo,
      },
    });
    expect(callbackUrl.pathname).toBe("/api/auth/callback");
    expect(callbackUrl.searchParams.get("redirect")).toBe("/notes/today");
  });

  it("OAuth 시작 실패 시 destructive toast를 표시한다", async () => {
    const user = userEvent.setup();
    signInWithOAuthMock.mockResolvedValue({
      error: new Error("provider is not enabled"),
    });

    render(<OAuthButtons mode="login" />);

    await user.click(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    );

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "소셜 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.",
        {
          variant: "destructive",
          dedupeKey: "auth-oauth-google",
        },
      );
    });
  });

  it("beforeSignIn이 false를 반환하면 OAuth 로그인을 시작하지 않는다", async () => {
    const user = userEvent.setup();
    const beforeSignIn = vi.fn(() => false);

    render(<OAuthButtons mode="signup" beforeSignIn={beforeSignIn} />);

    await user.click(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    );

    expect(beforeSignIn).toHaveBeenCalledTimes(1);
    expect(signInWithOAuthMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    ).toBeInTheDocument();
  });
});
