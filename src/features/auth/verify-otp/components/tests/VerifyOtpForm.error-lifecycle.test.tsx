import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useActionState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { RATE_LIMIT_TOAST_MESSAGE } from "@/features/auth/errors/rateLimitError";
import {
  INITIAL_VERIFY_OTP_ACTION_STATE,
  VerifyOtpActionState,
} from "@/features/auth/verify-otp/actions/verifyOtpActionState";

import VerifyOtpForm from "../VerifyOtpForm";

const mocks = vi.hoisted(() => {
  const routerReplace = vi.fn();

  return {
    routerReplace,
    router: {
      replace: routerReplace,
    },
  };
});

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

const mockUseActionState = vi.mocked(useActionState);
const mockFormAction = vi.fn();

const action = vi.fn(
  async (
    _prevState: VerifyOtpActionState,
    _formData: FormData,
  ): Promise<VerifyOtpActionState> => INITIAL_VERIFY_OTP_ACTION_STATE,
);

function setActionState(state: VerifyOtpActionState) {
  mockUseActionState.mockReturnValue([state, mockFormAction, false]);
}

function renderVerifyOtpForm() {
  return render(
    <VerifyOtpForm action={action} email="test@example.com" purpose="signup" />,
  );
}

function getOtpInput() {
  return screen.getByPlaceholderText("예: 123456");
}

describe("VerifyOtpForm root error lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseActionState.mockReturnValue([
      INITIAL_VERIFY_OTP_ACTION_STATE,
      mockFormAction,
      false,
    ]);
  });

  it("invalid_otp ATTEMPT root error는 OTP를 수정하면 제거한다", async () => {
    const state: VerifyOtpActionState = {
      status: "invalid_otp",
      formError: "인증 번호가 올바르지 않거나 만료되었습니다.",
    };

    setActionState(state);

    renderVerifyOtpForm();

    expect(await screen.findByTestId("form-error")).toHaveTextContent(
      "인증 번호가 올바르지 않거나 만료되었습니다.",
    );

    fireEvent.change(getOtpInput(), {
      target: { value: "2" },
    });

    await waitFor(() => {
      expect(screen.queryByTestId("form-error")).not.toBeInTheDocument();
    });
  });

  it("blocked SYSTEM root error는 OTP를 수정해도 유지한다", async () => {
    const state: VerifyOtpActionState = {
      status: "blocked",
      fieldErrors: null,
      reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT,
    };

    setActionState(state);

    renderVerifyOtpForm();

    expect(await screen.findByTestId("form-error")).toHaveTextContent(
      RATE_LIMIT_TOAST_MESSAGE,
    );

    fireEvent.change(getOtpInput(), {
      target: { value: "2" },
    });

    expect(screen.getByTestId("form-error")).toHaveTextContent(
      RATE_LIMIT_TOAST_MESSAGE,
    );
  });

  it("SYSTEM root error는 다음 유효한 요청 시작 시 제거한다", async () => {
    const state: VerifyOtpActionState = {
      status: "blocked",
      fieldErrors: null,
      reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT,
    };

    setActionState(state);

    renderVerifyOtpForm();

    expect(await screen.findByTestId("form-error")).toHaveTextContent(
      RATE_LIMIT_TOAST_MESSAGE,
    );

    fireEvent.change(getOtpInput(), {
      target: { value: "123456" },
    });

    expect(screen.getByTestId("form-error")).toHaveTextContent(
      RATE_LIMIT_TOAST_MESSAGE,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "인증하기" })).toBeEnabled();
    });

    const form = screen
      .getByRole("button", { name: "인증하기" })
      .closest("form");

    if (!form) {
      throw new Error("verify OTP form을 찾을 수 없습니다.");
    }

    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockFormAction).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("form-error")).not.toBeInTheDocument();
    });
  });
});
