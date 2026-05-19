import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireGuestPageMock = vi.hoisted(() => vi.fn());

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
);

const verifyOtpBoundActionMock = vi.hoisted(() => vi.fn());
const verifyOtpActionMock = vi.hoisted(() => {
  const action = vi.fn();
  action.bind = vi.fn(() => verifyOtpBoundActionMock);
  return action;
});

const VerifyOtpFormMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/utils/requireGuestPage", () => ({
  requireGuestPage: requireGuestPageMock,
}));

vi.mock("@/features/auth/verify-otp/actions/verifyOtpAction", () => ({
  verifyOtpAction: verifyOtpActionMock,
}));

vi.mock("@/features/auth/verify-otp/components/VerifyOtpForm", async () => {
  const React = await import("react");

  return {
    default: (props: { action: unknown; email: string; purpose: string }) => {
      VerifyOtpFormMock(props);

      return React.createElement("div", {
        "data-testid": "verify-otp-form",
        "data-email": props.email,
        "data-purpose": props.purpose,
      });
    },
  };
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { ROUTES } from "@/lib/constants/routes";

import VerifyOtpPage from "./page";

describe("VerifyOtpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("로그인 사용자 접근 제어를 위해 requireGuestPage를 호출한다", async () => {
    const element = await VerifyOtpPage({
      searchParams: Promise.resolve({
        email: "test@example.com",
        purpose: "signup",
      }),
    });

    render(element);

    expect(requireGuestPageMock).toHaveBeenCalledTimes(1);
  });

  it("purpose가 유효하지 않으면 로그인 페이지로 redirect한다", async () => {
    await expect(
      VerifyOtpPage({
        searchParams: Promise.resolve({
          email: "test@example.com",
          purpose: "invalid-purpose" as never,
        }),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.LOGIN}`);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
  });

  it("email이 없고 purpose가 유효하면 resend-email 페이지로 redirect한다", async () => {
    await expect(
      VerifyOtpPage({
        searchParams: Promise.resolve({
          email: "",
          purpose: "signup",
        }),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.RESEND_EMAIL}?purpose=signup`);

    expect(redirectMock).toHaveBeenCalledWith(
      `${ROUTES.RESEND_EMAIL}?purpose=signup`,
    );
  });

  it("정상 query면 VerifyOtpForm에 email, purpose, action을 전달한다", async () => {
    const element = await VerifyOtpPage({
      searchParams: Promise.resolve({
        email: "test@example.com",
        purpose: "signup",
      }),
    });

    render(element);

    expect(screen.getByTestId("verify-otp-form")).toHaveAttribute(
      "data-email",
      "test@example.com",
    );
    expect(screen.getByTestId("verify-otp-form")).toHaveAttribute(
      "data-purpose",
      "signup",
    );

    expect(VerifyOtpFormMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        purpose: "signup",
        action: verifyOtpBoundActionMock,
      }),
    );
  });

  it("redirect query가 있으면 verifyOtpAction.bind에 redirectPath를 전달한다", async () => {
    const redirectPath = "/reset-password";

    const element = await VerifyOtpPage({
      searchParams: Promise.resolve({
        email: "test@example.com",
        purpose: "reset-password",
        redirect: redirectPath,
      }),
    });

    render(element);

    expect(verifyOtpActionMock.bind).toHaveBeenCalledWith(null, redirectPath);
  });
});
