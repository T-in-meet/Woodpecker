import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useActionState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  INITIAL_SET_PASSWORD_ACTION_STATE,
  SetPasswordActionState,
} from "@/features/auth/set-password/actions/setPasswordActionState";
import {
  SET_PASSWORD_GLOBAL_ERROR_MESSAGE,
  SET_PASSWORD_PAGE_LEAVE_CONFIRM_MESSAGE,
  SET_PASSWORD_SAME_PASSWORD_MESSAGE,
} from "@/features/auth/set-password/constants/messages";
import { usePreventPageLeave } from "@/hooks/usePreventPageLeave";
import { VALIDATION_MESSAGES } from "@/lib/validation/messages";

import { SetPasswordForm } from "../SetPasswordForm";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: vi.fn(),
  };
});

vi.mock("@/hooks/usePreventPageLeave", () => ({
  usePreventPageLeave: vi.fn(),
}));

const mockUseActionState = vi.mocked(useActionState);
const mockUsePreventPageLeave = vi.mocked(usePreventPageLeave);
const mockFormAction = vi.fn();

const action = vi.fn(
  async (
    _prevState: SetPasswordActionState,
    _formData: FormData,
  ): Promise<SetPasswordActionState> => INITIAL_SET_PASSWORD_ACTION_STATE,
);

async function fillValidFields() {
  const user = userEvent.setup();

  const passwordInput = screen.getByLabelText("비밀번호");
  const confirmPasswordInput = screen.getByLabelText("비밀번호 확인");

  await user.type(passwordInput, "Password123!");
  await user.click(confirmPasswordInput);
  await user.type(confirmPasswordInput, "Password123!");
  await user.tab();

  return user;
}

describe("SetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseActionState.mockReturnValue([
      INITIAL_SET_PASSWORD_ACTION_STATE,
      mockFormAction,
      false,
    ]);
  });

  it("비밀번호 입력 필드와 비활성화된 제출 버튼을 렌더링한다", () => {
    render(<SetPasswordForm action={action} />);

    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호 확인")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "비밀번호 설정하기" }),
    ).toBeDisabled();

    expect(mockUseActionState).toHaveBeenCalledWith(
      action,
      INITIAL_SET_PASSWORD_ACTION_STATE,
    );
  });

  it("유효한 비밀번호와 동일한 확인값을 입력하면 제출 버튼이 활성화된다", async () => {
    render(<SetPasswordForm action={action} />);

    await fillValidFields();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "비밀번호 설정하기" }),
      ).toBeEnabled();
    });
  });

  it("클라이언트 검증에 실패하면 필드 에러를 표시하고 제출 버튼을 활성화하지 않는다", async () => {
    const user = userEvent.setup();

    render(<SetPasswordForm action={action} />);

    await user.type(screen.getByLabelText("비밀번호"), "short");
    await user.click(screen.getByLabelText("비밀번호 확인"));

    await waitFor(() => {
      expect(
        screen.getByText(VALIDATION_MESSAGES.passwordMinLength),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "비밀번호 설정하기" }),
    ).toBeDisabled();
    expect(mockFormAction).not.toHaveBeenCalled();
  });

  it("invalid_input 상태의 서버 필드 에러를 각 입력 필드에 표시한다", async () => {
    const state: SetPasswordActionState = {
      status: "invalid_input",
      fieldErrors: {
        password: ["비밀번호 서버 검증 오류"],
        confirmPassword: ["비밀번호 확인 서버 검증 오류"],
      },
    };

    mockUseActionState.mockReturnValue([state, mockFormAction, false]);

    render(<SetPasswordForm action={action} />);

    await waitFor(() => {
      expect(screen.getByText("비밀번호 서버 검증 오류")).toBeInTheDocument();
      expect(
        screen.getByText("비밀번호 확인 서버 검증 오류"),
      ).toBeInTheDocument();
    });
  });

  it("internal_error 상태이면 안전한 전역 에러 메시지를 표시한다", async () => {
    const state: SetPasswordActionState = {
      status: "internal_error",
    };

    mockUseActionState.mockReturnValue([state, mockFormAction, false]);

    render(<SetPasswordForm action={action} />);

    await waitFor(() => {
      expect(
        screen.getByText(SET_PASSWORD_GLOBAL_ERROR_MESSAGE),
      ).toBeInTheDocument();
    });
  });

  it("same_password 오류이면 전용 에러 메시지를 표시한다", async () => {
    const state: SetPasswordActionState = {
      status: "internal_error",
      reason: "same_password",
    };

    mockUseActionState.mockReturnValue([state, mockFormAction, false]);

    render(<SetPasswordForm action={action} />);

    await waitFor(() => {
      expect(
        screen.getByText(SET_PASSWORD_SAME_PASSWORD_MESSAGE),
      ).toBeInTheDocument();
    });
  });

  it("유효한 값을 제출하면 password와 confirmPassword를 FormData로 전달한다", async () => {
    render(<SetPasswordForm action={action} />);

    const user = await fillValidFields();

    const submitButton = screen.getByRole("button", {
      name: "비밀번호 설정하기",
    });

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    await user.click(submitButton);

    await waitFor(() => {
      expect(mockFormAction).toHaveBeenCalledTimes(1);
    });

    const formData = mockFormAction.mock.calls[0]?.[0];

    expect(formData).toBeInstanceOf(FormData);
    expect((formData as FormData).get("password")).toBe("Password123!");
    expect((formData as FormData).get("confirmPassword")).toBe("Password123!");
  });

  it("pending 상태에서는 제출 버튼을 비활성화하고 진행 중 문구를 표시한다", () => {
    mockUseActionState.mockReturnValue([
      INITIAL_SET_PASSWORD_ACTION_STATE,
      mockFormAction,
      true,
    ]);

    render(<SetPasswordForm action={action} />);

    expect(screen.getByRole("button", { name: "설정 중..." })).toBeDisabled();
  });

  it("입력이 변경되면 페이지 이탈 방지를 활성화한다", async () => {
    const user = userEvent.setup();

    render(<SetPasswordForm action={action} />);

    expect(mockUsePreventPageLeave).toHaveBeenLastCalledWith(
      false,
      SET_PASSWORD_PAGE_LEAVE_CONFIRM_MESSAGE,
    );

    await user.type(screen.getByLabelText("비밀번호"), "P");

    await waitFor(() => {
      expect(mockUsePreventPageLeave).toHaveBeenLastCalledWith(
        true,
        SET_PASSWORD_PAGE_LEAVE_CONFIRM_MESSAGE,
      );
    });
  });
});
