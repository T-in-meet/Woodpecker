import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fillResetPasswordFields,
  renderResetPasswordForm,
  setIdleActionState,
  submitResetPasswordForm,
} from "@/features/auth/reset-password/components/tests/utils/reset-password-form-test-utils";
import {
  RESET_PASSWORD_GLOBAL_ERROR_MESSAGE,
  RESET_PASSWORD_SAME_PASSWORD_MESSAGE,
} from "@/features/auth/reset-password/constants/messages";
import { VALIDATION_MESSAGES } from "@/lib/validation/messages";

const hoisted = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
  formActionMock: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: hoisted.useActionStateMock,
  };
});

describe("reset-password-form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setIdleActionState(hoisted.useActionStateMock, hoisted.formActionMock);
  });

  it("TC1/TC2: 기본 UI를 렌더링하고 초기 submit 버튼은 비활성화한다", () => {
    renderResetPasswordForm();

    expect(
      screen.getByRole("heading", { name: "비밀번호 재설정" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^비밀번호$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/비밀번호 확인/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "비밀번호 변경하기" }),
    ).toBeDisabled();
  });

  it("유효한 비밀번호와 확인 값을 입력하면 submit 버튼을 활성화한다", async () => {
    renderResetPasswordForm();

    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "valid-password",
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "비밀번호 변경하기" }),
      ).toBeEnabled();
    });
  });

  it("TC3: pending 상태면 버튼 문구와 disabled를 반영한다", () => {
    hoisted.useActionStateMock.mockReturnValue([
      { status: "idle" },
      hoisted.formActionMock,
      true,
    ]);

    renderResetPasswordForm();

    expect(screen.getByRole("button", { name: "변경 중..." })).toBeDisabled();
  });

  it("TC14/TC15/TC16/TC17: submit payload는 password/confirmPassword만 포함하고 redirect hidden input이 없다", async () => {
    const { container } = renderResetPasswordForm();

    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "valid-password",
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "비밀번호 변경하기" }),
      ).toBeEnabled();
    });

    submitResetPasswordForm();

    await waitFor(() => {
      expect(hoisted.formActionMock).toHaveBeenCalledTimes(1);
    });

    const payload = hoisted.formActionMock.mock.calls[0]?.[0] as FormData;

    expect(payload.get("password")).toBe("valid-password");
    expect(payload.get("confirmPassword")).toBe("valid-password");
    expect(payload.has("redirect")).toBe(false);
    expect(
      container.querySelector('input[type="hidden"][name="redirect"]'),
    ).toBeNull();
  });

  it("TC18: action state password invalid_input을 RHF field error로 표시한다", async () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "invalid_input",
        fieldErrors: { password: [VALIDATION_MESSAGES.passwordMinLength] },
      },
      hoisted.formActionMock,
      false,
    ]);

    renderResetPasswordForm();

    expect(
      await screen.findByText(VALIDATION_MESSAGES.passwordMinLength),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
    ).not.toBeInTheDocument();
  });

  it("TC19: action state confirmPassword invalid_input을 RHF field error로 표시한다", async () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "invalid_input",
        fieldErrors: {
          confirmPassword: [VALIDATION_MESSAGES.passwordMismatch],
        },
      },
      hoisted.formActionMock,
      false,
    ]);

    renderResetPasswordForm();

    expect(
      await screen.findByText(VALIDATION_MESSAGES.passwordMismatch),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
    ).not.toBeInTheDocument();
  });

  it("TC20/TC21: action state internal_error는 root error로 표시한다", async () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "internal_error",
      },
      hoisted.formActionMock,
      false,
    ]);

    renderResetPasswordForm();

    expect(
      await screen.findByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.queryByText("supabase error")).not.toBeInTheDocument();
  });

  it("same_password는 전용 root error를 표시한다", async () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "internal_error",
        reason: "same_password",
      },
      hoisted.formActionMock,
      false,
    ]);

    renderResetPasswordForm();

    expect(
      await screen.findByText(RESET_PASSWORD_SAME_PASSWORD_MESSAGE),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
    ).not.toBeInTheDocument();
  });

  it("same_password ATTEMPT root error는 password를 수정하면 제거한다", async () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "internal_error",
        reason: "same_password",
      },
      hoisted.formActionMock,
      false,
    ]);

    renderResetPasswordForm();

    expect(
      await screen.findByText(RESET_PASSWORD_SAME_PASSWORD_MESSAGE),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^비밀번호$/i), {
      target: { value: "changed-password" },
    });

    await waitFor(() => {
      expect(
        screen.queryByText(RESET_PASSWORD_SAME_PASSWORD_MESSAGE),
      ).not.toBeInTheDocument();
    });
  });

  it("same_password ATTEMPT root error는 confirmPassword만 수정하면 유지한다", async () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "internal_error",
        reason: "same_password",
      },
      hoisted.formActionMock,
      false,
    ]);

    renderResetPasswordForm();

    expect(
      await screen.findByText(RESET_PASSWORD_SAME_PASSWORD_MESSAGE),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/비밀번호 확인/i), {
      target: { value: "changed-password" },
    });

    expect(
      screen.getByText(RESET_PASSWORD_SAME_PASSWORD_MESSAGE),
    ).toBeInTheDocument();
  });

  it("SYSTEM root error는 password를 수정해도 유지한다", async () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "internal_error",
      },
      hoisted.formActionMock,
      false,
    ]);

    renderResetPasswordForm();

    expect(
      await screen.findByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^비밀번호$/i), {
      target: { value: "changed-password" },
    });

    expect(
      screen.getByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
    ).toBeInTheDocument();
  });

  it("SYSTEM root error는 다음 유효한 submit 시작 시 제거한다", async () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "internal_error",
      },
      hoisted.formActionMock,
      false,
    ]);

    renderResetPasswordForm();

    expect(
      await screen.findByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
    ).toBeInTheDocument();

    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "valid-password",
    });

    expect(
      screen.getByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "비밀번호 변경하기" }),
      ).toBeEnabled();
    });

    submitResetPasswordForm();

    await waitFor(() => {
      expect(hoisted.formActionMock).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
      ).not.toBeInTheDocument();
    });
  });

  it("TC22: idle에서는 global error UI를 표시하지 않는다", async () => {
    const user = userEvent.setup();

    renderResetPasswordForm();

    await user.type(screen.getByLabelText(/^비밀번호$/i), "secret-value");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "secret-value");

    expect(
      screen.queryByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
    ).not.toBeInTheDocument();
  });

  it("TC23: idle에서는 입력한 민감값을 화면 텍스트로 노출하지 않는다", async () => {
    const user = userEvent.setup();

    renderResetPasswordForm();

    await user.type(screen.getByLabelText(/^비밀번호$/i), "secret-value");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "secret-value");

    expect(screen.queryByText("secret-value")).not.toBeInTheDocument();
  });

  it("TC24: idle에서는 성공 UI를 표시하지 않는다", async () => {
    const user = userEvent.setup();

    renderResetPasswordForm();

    await user.type(screen.getByLabelText(/^비밀번호$/i), "secret-value");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "secret-value");

    expect(screen.queryByText(/변경 완료|성공/i)).not.toBeInTheDocument();
  });

  it("TC25: idle에서는 rejected UI를 표시하지 않는다", async () => {
    const user = userEvent.setup();

    renderResetPasswordForm();

    await user.type(screen.getByLabelText(/^비밀번호$/i), "secret-value");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "secret-value");

    expect(screen.queryByText(/거부|rejected/i)).not.toBeInTheDocument();
  });
});
