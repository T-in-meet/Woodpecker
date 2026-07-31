import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthEmailForm from "@/features/auth/components/AuthEmailForm";
import { forgotPasswordAction } from "@/features/auth/forgot-password/actions/forgotPasswordAction";
import { INITIAL_FORGOT_PASSWORD_ACTION_STATE } from "@/features/auth/forgot-password/actions/forgotPasswordActionState";
import { requireGuestPage } from "@/features/auth/utils/requireGuestPage";

import ForgotPasswordPage, { metadata } from "./page";

vi.mock("@/features/auth/utils/requireGuestPage", () => ({
  requireGuestPage: vi.fn(),
}));

vi.mock("@/features/auth/forgot-password/actions/forgotPasswordAction", () => ({
  forgotPasswordAction: vi.fn(),
}));

vi.mock("@/features/auth/components/AuthEmailForm", () => ({
  default: vi.fn(() => <div data-testid="auth-email-form" />),
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("검색 엔진 인덱싱을 방지한다", () => {
    expect(metadata).toEqual({
      robots: { index: false, follow: false },
    });
  });

  it("게스트 전용 페이지 접근 검사를 수행한다", async () => {
    const page = await ForgotPasswordPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(requireGuestPage).toHaveBeenCalledTimes(1);
  });

  it("AuthEmailForm에 reset-password 목적과 초기 상태를 전달한다", async () => {
    const page = await ForgotPasswordPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(AuthEmailForm).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.any(Function),
        initialState: INITIAL_FORGOT_PASSWORD_ACTION_STATE,
        email: undefined,
        purpose: "reset-password",
      }),
      undefined,
    );
  });

  it("email query가 문자열이면 AuthEmailForm에 전달한다", async () => {
    const page = await ForgotPasswordPage({
      searchParams: Promise.resolve({
        email: "user@example.com",
      }),
    });

    render(page);

    expect(AuthEmailForm).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
      }),
      undefined,
    );
  });

  it("email query가 배열이면 무시한다", async () => {
    const page = await ForgotPasswordPage({
      searchParams: Promise.resolve({
        email: ["a@example.com", "b@example.com"],
      }),
    });

    render(page);

    expect(AuthEmailForm).toHaveBeenCalledWith(
      expect.objectContaining({
        email: undefined,
      }),
      undefined,
    );
  });

  it("redirect query가 문자열이면 action에 redirectPath를 bind로 주입한다", async () => {
    const page = await ForgotPasswordPage({
      searchParams: Promise.resolve({
        redirect: "/mypage",
      }),
    });

    render(page);

    const props = vi.mocked(AuthEmailForm).mock.calls[0]![0];
    const formData = new FormData();

    await props.action(INITIAL_FORGOT_PASSWORD_ACTION_STATE, formData);

    expect(forgotPasswordAction).toHaveBeenCalledWith(
      "/mypage",
      INITIAL_FORGOT_PASSWORD_ACTION_STATE,
      formData,
    );
  });

  it("redirect query가 없으면 action에 null을 bind로 주입한다", async () => {
    const page = await ForgotPasswordPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    const props = vi.mocked(AuthEmailForm).mock.calls[0]![0];
    const formData = new FormData();

    await props.action(INITIAL_FORGOT_PASSWORD_ACTION_STATE, formData);

    expect(forgotPasswordAction).toHaveBeenCalledWith(
      null,
      INITIAL_FORGOT_PASSWORD_ACTION_STATE,
      formData,
    );
  });

  it("redirect query가 배열이면 action에 null을 bind로 주입한다", async () => {
    const page = await ForgotPasswordPage({
      searchParams: Promise.resolve({
        redirect: ["/mypage", "/admin"],
      }),
    });

    render(page);

    const props = vi.mocked(AuthEmailForm).mock.calls[0]![0];
    const formData = new FormData();

    await props.action(INITIAL_FORGOT_PASSWORD_ACTION_STATE, formData);

    expect(forgotPasswordAction).toHaveBeenCalledWith(
      null,
      INITIAL_FORGOT_PASSWORD_ACTION_STATE,
      formData,
    );
  });
});
