import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { AUTH_GLOBAL_ERROR_MESSAGE } from "@/features/auth/constants/messages";
import { OTP_LENGTH } from "@/features/auth/constants/otp";
import { RATE_LIMIT_TOAST_MESSAGE } from "@/features/auth/errors/rateLimitError";
import type { VerifyOtpActionState } from "@/features/auth/verify-otp/actions/verifyOtpActionState";
import { ROUTES } from "@/lib/constants/routes";

import VerifyOtpForm from "./VerifyOtpForm";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  routerReplace: vi.fn(),
}));

vi.mock("@/lib/utils/showToast", () => ({
  showToast: mocks.showToast,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.routerReplace,
  }),
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

    expect(screen.getByRole("button", { name: "인증하기" })).toBeDisabled();
  });

  it("유효한 OTP를 입력하면 인증 버튼이 활성화된다", async () => {
    const user = userEvent.setup();

    renderVerifyOtpForm();

    await user.type(screen.getByPlaceholderText("예: 123456"), validOtp);

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

    expect(screen.getByRole("button", { name: "인증하기" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() => {
      expect(action).not.toHaveBeenCalled();
    });
  });

  it("invalid_request 상태면 resend-email 페이지로 이동한다", async () => {
    const user = userEvent.setup();

    const action = vi.fn().mockResolvedValue({
      status: "invalid_request",
      fieldErrors: null,
      reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
    } satisfies VerifyOtpActionState);

    renderVerifyOtpForm(action);

    await user.type(screen.getByPlaceholderText("예: 123456"), validOtp);
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() => {
      expect(mocks.routerReplace).toHaveBeenCalledWith(
        `${ROUTES.RESEND_EMAIL}?purpose=signup`,
      );
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

  it("blocked 상태면 rate limit 안내를 폼 안에 남긴다", async () => {
    const user = userEvent.setup();

    const action = vi.fn().mockResolvedValue({
      status: "blocked",
      fieldErrors: null,
      reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT,
    } satisfies VerifyOtpActionState);

    renderVerifyOtpForm(action);

    await user.type(screen.getByPlaceholderText("예: 123456"), validOtp);
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    expect(await screen.findByTestId("form-error")).toHaveTextContent(
      RATE_LIMIT_TOAST_MESSAGE,
    );
    expect(mocks.showToast).not.toHaveBeenCalled();
  });

  it("internal_error 상태면 글로벌 에러를 폼 안에 남긴다", async () => {
    const user = userEvent.setup();

    const action = vi.fn().mockResolvedValue({
      status: "internal_error",
      fieldErrors: null,
      reasonCode: "INTERNAL_ERROR",
    } satisfies VerifyOtpActionState);

    renderVerifyOtpForm(action);

    await user.type(screen.getByPlaceholderText("예: 123456"), validOtp);
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    expect(await screen.findByTestId("form-error")).toHaveTextContent(
      AUTH_GLOBAL_ERROR_MESSAGE,
    );
    expect(mocks.showToast).not.toHaveBeenCalled();
  });

  it("인증번호 재전송 링크를 렌더링한다", () => {
    renderVerifyOtpForm();

    const query = new URLSearchParams({
      purpose: "signup",
      email: defaultProps.email,
    });

    const returnTo = `${ROUTES.VERIFY_OTP}?${query.toString()}`;

    query.set("returnTo", returnTo);

    expect(
      screen.getByRole("link", { name: "인증번호 재전송" }),
    ).toHaveAttribute("href", `${ROUTES.RESEND_EMAIL}?${query.toString()}`);
  });
});
