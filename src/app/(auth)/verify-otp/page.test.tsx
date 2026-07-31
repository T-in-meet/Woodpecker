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
    default: (props: {
      action: unknown;
      email: string;
      purpose: string;
      redirect?: string | null;
    }) => {
      VerifyOtpFormMock(props);

      return React.createElement("div", {
        "data-testid": "verify-otp-form",
        "data-email": props.email,
        "data-purpose": props.purpose,
        "data-redirect": props.redirect ?? "",
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

  it("email이 없고 signup purpose와 redirect가 있으면 검증된 redirect를 포함해 resend-email 페이지로 redirect한다", async () => {
    await expect(
      VerifyOtpPage({
        searchParams: Promise.resolve({
          email: "",
          purpose: "signup",
          redirect: "/mypage",
        }),
      }),
    ).rejects.toThrow(
      `NEXT_REDIRECT:${ROUTES.RESEND_EMAIL}?purpose=signup&redirect=%2Fmypage`,
    );

    expect(redirectMock).toHaveBeenCalledWith(
      `${ROUTES.RESEND_EMAIL}?purpose=signup&redirect=%2Fmypage`,
    );
  });

  it("email이 없고 signup purpose와 외부 redirect가 있으면 fallback redirect를 포함해 resend-email 페이지로 redirect한다", async () => {
    await expect(
      VerifyOtpPage({
        searchParams: Promise.resolve({
          email: "",
          purpose: "signup",
          redirect: "https://evil.com",
        }),
      }),
    ).rejects.toThrow(
      `NEXT_REDIRECT:${ROUTES.RESEND_EMAIL}?purpose=signup&redirect=${encodeURIComponent(
        ROUTES.MYPAGE,
      )}`,
    );

    expect(redirectMock).toHaveBeenCalledWith(
      `${ROUTES.RESEND_EMAIL}?purpose=signup&redirect=${encodeURIComponent(
        ROUTES.MYPAGE,
      )}`,
    );
  });

  it("email이 없고 reset-password purpose와 redirect가 있으면 raw redirect를 포함해 resend-email 페이지로 redirect한다", async () => {
    await expect(
      VerifyOtpPage({
        searchParams: Promise.resolve({
          email: "",
          purpose: "reset-password",
          redirect: "https://evil.com",
        }),
      }),
    ).rejects.toThrow(
      `NEXT_REDIRECT:${ROUTES.RESEND_EMAIL}?purpose=reset-password&redirect=${encodeURIComponent(
        "https://evil.com",
      )}`,
    );

    expect(redirectMock).toHaveBeenCalledWith(
      `${ROUTES.RESEND_EMAIL}?purpose=reset-password&redirect=${encodeURIComponent(
        "https://evil.com",
      )}`,
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
        redirect: null,
        action: verifyOtpBoundActionMock,
      }),
    );
  });

  it("reset-password 목적이면 redirect query를 검증하지 않고 그대로 verifyOtpAction.bind에 전달한다", async () => {
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

  it("signup 목적이면 redirect query를 검증한 뒤 verifyOtpAction.bind에 전달한다", async () => {
    const redirectPath = "/mypage";

    const element = await VerifyOtpPage({
      searchParams: Promise.resolve({
        email: "test@example.com",
        purpose: "signup",
        redirect: redirectPath,
      }),
    });

    render(element);

    expect(verifyOtpActionMock.bind).toHaveBeenCalledWith(null, redirectPath);
  });

  it("signup 목적이고 redirect query가 외부 URL이면 검증 결과를 verifyOtpAction.bind에 전달한다", async () => {
    const element = await VerifyOtpPage({
      searchParams: Promise.resolve({
        email: "test@example.com",
        purpose: "signup",
        redirect: "https://evil.com",
      }),
    });

    render(element);

    expect(verifyOtpActionMock.bind).toHaveBeenCalledWith(null, ROUTES.MYPAGE);
  });

  it("정상 query에 redirect가 있으면 VerifyOtpForm에 redirect를 전달한다", async () => {
    const element = await VerifyOtpPage({
      searchParams: Promise.resolve({
        email: "test@example.com",
        purpose: "reset-password",
        redirect: "/reset-password",
      }),
    });

    render(element);

    expect(VerifyOtpFormMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        purpose: "reset-password",
        redirect: "/reset-password",
        action: verifyOtpBoundActionMock,
      }),
    );
  });
});
