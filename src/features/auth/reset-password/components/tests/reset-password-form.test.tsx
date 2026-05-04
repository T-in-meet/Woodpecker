import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PASSWORD_MIN_LENGTH_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
} from "@/features/auth/constants/messages";
import {
  fillResetPasswordFields,
  renderResetPasswordForm,
  setIdleActionState,
  submitResetPasswordForm,
} from "@/features/auth/reset-password/components/tests/utils/reset-password-form-test-utils";
import { RESET_PASSWORD_GLOBAL_ERROR_MESSAGE } from "@/features/auth/reset-password/constants/messages";

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

  it("TC1/TC2: 기본 렌더링과 기본 버튼 문구를 표시한다", () => {
    renderResetPasswordForm();

    expect(screen.getByLabelText(/^비밀번호$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/비밀번호 확인/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "비밀번호 변경하기" }),
    ).toBeInTheDocument();
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

  it("TC18: action state password invalid_input을 표시한다", () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "invalid_input",
        fieldErrors: { password: [PASSWORD_MIN_LENGTH_MESSAGE] },
      },
      hoisted.formActionMock,
      false,
    ]);

    renderResetPasswordForm();

    expect(screen.getByText(PASSWORD_MIN_LENGTH_MESSAGE)).toBeInTheDocument();
    expect(
      screen.queryByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
    ).not.toBeInTheDocument();
  });

  it("TC19: action state confirmPassword invalid_input을 표시한다", () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "invalid_input",
        fieldErrors: { confirmPassword: [PASSWORD_MISMATCH_MESSAGE] },
      },
      hoisted.formActionMock,
      false,
    ]);

    renderResetPasswordForm();

    expect(screen.getByText(PASSWORD_MISMATCH_MESSAGE)).toBeInTheDocument();
    expect(
      screen.queryByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
    ).not.toBeInTheDocument();
  });

  it("TC20/TC21: action state internal_error는 global 영역에만 표시한다", () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "internal_error",
      },
      hoisted.formActionMock,
      false,
    ]);

    renderResetPasswordForm();

    expect(
      screen.getByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.queryByText("supabase error")).not.toBeInTheDocument();
  });
});
