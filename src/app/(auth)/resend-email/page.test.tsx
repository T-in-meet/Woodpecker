import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthEmailForm from "@/features/auth/components/AuthEmailForm";
import { resendEmailAction } from "@/features/auth/resend-email/actions/resendEmailAction";
import { INITIAL_RESEND_EMAIL_ACTION_STATE } from "@/features/auth/resend-email/actions/resendEmailActionState";
import { requireGuestPage } from "@/features/auth/utils/requireGuestPage";
import { ROUTES } from "@/lib/constants/routes";

import ResendEmailPage, { metadata } from "./page";

vi.mock("@/features/auth/utils/requireGuestPage", () => ({
  requireGuestPage: vi.fn(),
}));

const boundResendEmailAction = vi.fn();

vi.mock("@/features/auth/resend-email/actions/resendEmailAction", () => {
  const action = vi.fn();

  action.bind = vi.fn(() => boundResendEmailAction);

  return {
    resendEmailAction: action,
  };
});

vi.mock("@/features/auth/components/AuthEmailForm", () => ({
  default: vi.fn(() => <div data-testid="resend-email-form" />),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

describe("ResendEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("검색 엔진 인덱싱을 막는다", () => {
    expect(metadata).toEqual({
      robots: { index: false, follow: false },
    });
  });

  it("게스트 전용 페이지 검사를 수행한다", async () => {
    const page = await ResendEmailPage({
      searchParams: Promise.resolve({
        email: "user@example.com",
        purpose: "signup",
      }),
    });

    render(page);

    expect(requireGuestPage).toHaveBeenCalledTimes(1);
  });

  it("유효한 purpose와 email을 AuthEmailForm에 전달한다", async () => {
    const page = await ResendEmailPage({
      searchParams: Promise.resolve({
        email: "user@example.com",
        purpose: "signup",
      }),
    });

    render(page);

    expect(screen.getByTestId("resend-email-form")).toBeInTheDocument();

    expect(AuthEmailForm).toHaveBeenCalledWith(
      expect.objectContaining({
        action: boundResendEmailAction,
        initialState: INITIAL_RESEND_EMAIL_ACTION_STATE,
        email: "user@example.com",
        purpose: "signup",
      }),
      undefined,
    );
  });

  it("email이 없으면 undefined를 Form에 전달한다", async () => {
    const page = await ResendEmailPage({
      searchParams: Promise.resolve({
        purpose: "signup",
      }),
    });

    render(page);

    expect(AuthEmailForm).toHaveBeenCalledWith(
      expect.objectContaining({
        initialState: INITIAL_RESEND_EMAIL_ACTION_STATE,
        email: undefined,
        purpose: "signup",
      }),
      undefined,
    );
  });

  it("redirect가 문자열이면 action bind에 전달한다", async () => {
    const page = await ResendEmailPage({
      searchParams: Promise.resolve({
        email: "user@example.com",
        purpose: "signup",
        redirect: "/mypage",
      }),
    });

    render(page);

    expect(resendEmailAction.bind).toHaveBeenCalledWith(null, "/mypage");
  });

  it("redirect가 없으면 action bind에 null을 전달한다", async () => {
    const page = await ResendEmailPage({
      searchParams: Promise.resolve({
        email: "user@example.com",
        purpose: "signup",
      }),
    });

    render(page);

    expect(resendEmailAction.bind).toHaveBeenCalledWith(null, null);
  });

  it("email query가 배열이면 undefined로 처리한다", async () => {
    const page = await ResendEmailPage({
      searchParams: Promise.resolve({
        email: ["a@example.com", "b@example.com"],
        purpose: "signup",
      }),
    });

    render(page);

    expect(AuthEmailForm).toHaveBeenCalledWith(
      expect.objectContaining({
        initialState: INITIAL_RESEND_EMAIL_ACTION_STATE,
        email: undefined,
        purpose: "signup",
      }),
      undefined,
    );
  });

  it("purpose가 유효하지 않으면 로그인 페이지로 redirect한다", async () => {
    await expect(
      ResendEmailPage({
        searchParams: Promise.resolve({
          email: "user@example.com",
          purpose: "invalid-purpose",
        }),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.LOGIN}`);
  });

  it("purpose query가 배열이면 로그인 페이지로 redirect한다", async () => {
    await expect(
      ResendEmailPage({
        searchParams: Promise.resolve({
          email: "user@example.com",
          purpose: ["signup", "reset-password"],
        }),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.LOGIN}`);
  });
});
