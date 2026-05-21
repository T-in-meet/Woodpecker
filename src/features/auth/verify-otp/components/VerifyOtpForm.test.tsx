import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { AUTH_GLOBAL_ERROR_MESSAGE } from "@/features/auth/constants/messages";
import { OTP_LENGTH } from "@/features/auth/constants/otp";
import { RATE_LIMIT_TOAST_MESSAGE } from "@/features/auth/errors/rateLimitError";
import type { VerifyOtpActionState } from "@/features/auth/verify-otp/actions/verifyOtpActionState";

import VerifyOtpForm from "./VerifyOtpForm";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

vi.mock("@/lib/utils/showToast", () => ({
  showToast: mocks.showToast,
}));

const validOtp = "1".repeat(OTP_LENGTH);

const defaultProps = {
  email: "test@example.com",
  purpose: "signup" as const,
};

const idleState: VerifyOtpActionState = {
  status: "idle",
  fieldErrors: null,
};

const renderVerifyOtpForm = (
  action: (
    prevState: VerifyOtpActionState,
    formData: FormData,
  ) => Promise<VerifyOtpActionState> = vi.fn().mockResolvedValue(idleState),
) => {
  return render(<VerifyOtpForm {...defaultProps} action={action} />);
};

describe("VerifyOtpForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("OTP 입력 폼을 렌더링한다", () => {
    renderVerifyOtpForm();

    expect(
      screen.getByRole("heading", { name: "인증 번호 확인" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("form", { name: "인증번호 입력" }),
    ).toBeInTheDocument();

    expect(screen.getByPlaceholderText("예: 123456")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "인증하기" })).toBeEnabled();
  });

  it("유효한 OTP 입력 시 email, purpose, otp를 FormData로 전달한다", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue(idleState);

    renderVerifyOtpForm(action);

    await user.type(screen.getByPlaceholderText("예: 123456"), validOtp);
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() => {
      expect(action).toHaveBeenCalled();
    });

    const formData = action.mock.calls[0]?.[1] as FormData;

    expect(formData.get("email")).toBe(defaultProps.email);
    expect(formData.get("purpose")).toBe(defaultProps.purpose);
    expect(formData.get("otp")).toBe(validOtp);
  });

  it("OTP 형식이 유효하지 않으면 action을 호출하지 않는다", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue(idleState);

    renderVerifyOtpForm(action);

    await user.type(screen.getByPlaceholderText("예: 123456"), "abc");
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() => {
      expect(action).not.toHaveBeenCalled();
    });
  });

  it("invalid_input 상태면 OTP 필드 에러를 표시한다", async () => {
    const user = userEvent.setup();

    const action = vi.fn().mockResolvedValue({
      status: "invalid_input",
      fieldErrors: {
        otp: "인증 번호 형식이 올바르지 않습니다.",
      },
    } satisfies VerifyOtpActionState);

    renderVerifyOtpForm(action);

    await user.type(screen.getByPlaceholderText("예: 123456"), validOtp);
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    expect(
      await screen.findByText("인증 번호 형식이 올바르지 않습니다."),
    ).toBeInTheDocument();
  });

  it("invalid_otp 상태면 인증 실패 메시지를 표시한다", async () => {
    const user = userEvent.setup();

    const action = vi.fn().mockResolvedValue({
      status: "invalid_otp",
      formError: "인증 번호가 올바르지 않거나 만료되었습니다.",
    } satisfies VerifyOtpActionState);

    renderVerifyOtpForm(action);

    await user.type(screen.getByPlaceholderText("예: 123456"), validOtp);
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    expect(
      await screen.findByText("인증 번호가 올바르지 않거나 만료되었습니다."),
    ).toBeInTheDocument();
  });

  it("blocked 상태면 rate limit toast를 표시한다", async () => {
    const user = userEvent.setup();

    const action = vi.fn().mockResolvedValue({
      status: "blocked",
      fieldErrors: null,
      reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT,
    } satisfies VerifyOtpActionState);

    renderVerifyOtpForm(action);

    await user.type(screen.getByPlaceholderText("예: 123456"), validOtp);
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(RATE_LIMIT_TOAST_MESSAGE, {
        variant: "destructive",
        dedupeKey: "auth-rate-limit",
      });
    });
  });

  it("internal_error 상태면 글로벌 에러 toast를 표시한다", async () => {
    const user = userEvent.setup();

    const action = vi.fn().mockResolvedValue({
      status: "internal_error",
      fieldErrors: null,
      reasonCode: "INTERNAL_ERROR",
    } satisfies VerifyOtpActionState);

    renderVerifyOtpForm(action);

    await user.type(screen.getByPlaceholderText("예: 123456"), validOtp);
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(AUTH_GLOBAL_ERROR_MESSAGE, {
        variant: "destructive",
        dedupeKey: "auth-global-error",
      });
    });
  });

  it("인증번호 재전송 링크를 렌더링한다", () => {
    renderVerifyOtpForm();

    expect(
      screen.getByRole("link", { name: "인증번호 재전송" }),
    ).toHaveAttribute(
      "href",
      `/resend-email?purpose=signup&email=${defaultProps.email}`,
    );
  });
});
