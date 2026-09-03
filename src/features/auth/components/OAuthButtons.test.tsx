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

  it("OAuth provider 버튼과 provider 로고를 렌더링한다", () => {
    render(<OAuthButtons intent="login" />);

    expect(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    ).toBeInTheDocument();
    const googleButton = screen.getByRole("button", {
      name: "Google 계정으로 계속하기",
    });
    const logo = googleButton.querySelector("img");

    // 로고는 시각 장식이며 버튼 이름에는 포함되지 않아야 한다.
    expect(logo?.getAttribute("src")).toContain(
      encodeURIComponent("/images/logos/google.webp"),
    );
    expect(logo).toHaveAttribute("aria-hidden", "true");
  });

  it("동일한 컴포넌트를 재사용 렌더링할 수 있다", () => {
    render(<OAuthButtons intent="login" />);

    expect(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    ).toBeInTheDocument();
  });

  it("provider와 Supabase callback redirect URL로 OAuth를 시작한다", async () => {
    const user = userEvent.setup();
    render(<OAuthButtons intent="login" />);

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

  it("intent와 redirect prop을 callback URL query로 유지한다", async () => {
    const user = userEvent.setup();
    render(<OAuthButtons intent="signup" redirect="/notes/today" />);

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
    expect(callbackUrl.searchParams.get("intent")).toBe("signup");
    expect(callbackUrl.searchParams.get("redirect")).toBe("/notes/today");
  });

  it("OAuth 시작 실패 시 버튼 아래에 오류 문구를 남긴다", async () => {
    const user = userEvent.setup();
    signInWithOAuthMock.mockResolvedValue({
      error: new Error("provider is not enabled"),
    });

    render(<OAuthButtons intent="login" />);

    await user.click(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    );

    // 재시도가 필요한 오류라 사라지는 toast가 아니라 버튼 아래에 남는다.
    expect(await screen.findByTestId("form-error")).toHaveTextContent(
      "소셜 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.",
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it("beforeSignIn이 false를 반환하면 OAuth 로그인을 시작하지 않는다", async () => {
    const user = userEvent.setup();
    const beforeSignIn = vi.fn(() => false);

    render(<OAuthButtons intent="signup" beforeSignIn={beforeSignIn} />);

    await user.click(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    );

    expect(beforeSignIn).toHaveBeenCalledTimes(1);
    expect(signInWithOAuthMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    ).toBeInTheDocument();
  });

  it("beforeSignIn이 resolve된 뒤 OAuth 로그인을 시작한다", async () => {
    const user = userEvent.setup();
    const beforeSignIn = vi.fn().mockResolvedValue(true);

    render(<OAuthButtons intent="signup" beforeSignIn={beforeSignIn} />);

    await user.click(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    );

    await waitFor(() => {
      expect(beforeSignIn).toHaveBeenCalledTimes(1);
      expect(signInWithOAuthMock).toHaveBeenCalledTimes(1);
    });
  });
});
