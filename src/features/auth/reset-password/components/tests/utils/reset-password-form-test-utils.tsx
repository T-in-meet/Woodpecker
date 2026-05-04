import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { ResetPasswordActionState } from "@/features/auth/reset-password/actions/resetPasswordActionState";
import { ResetPasswordForm } from "@/features/auth/reset-password/components/ResetPasswordForm";

type BoundResetPasswordAction = (
  prevState: ResetPasswordActionState,
  formData: FormData,
) => Promise<ResetPasswordActionState>;

export function renderResetPasswordForm() {
  const boundActionMock = vi.fn(
    async () => ({ status: "idle" }) satisfies ResetPasswordActionState,
  ) as BoundResetPasswordAction;

  return render(<ResetPasswordForm action={boundActionMock} />);
}

export function setIdleActionState(
  useActionStateMock: ReturnType<typeof vi.fn>,
  formActionMock: ReturnType<typeof vi.fn>,
) {
  useActionStateMock.mockReturnValue([
    { status: "idle" },
    formActionMock,
    false,
  ]);
}

export function fillResetPasswordFields(values: {
  password: string;
  confirmPassword: string;
}) {
  fireEvent.change(screen.getByLabelText(/^비밀번호$/i), {
    target: { value: values.password },
  });

  fireEvent.change(screen.getByLabelText(/비밀번호 확인/i), {
    target: { value: values.confirmPassword },
  });
}

export function blurPasswordField() {
  fireEvent.blur(screen.getByLabelText(/^비밀번호$/i));
}

export function blurConfirmPasswordField() {
  fireEvent.blur(screen.getByLabelText(/비밀번호 확인/i));
}

export function submitResetPasswordForm() {
  const submitButton = screen.getByRole("button", {
    name: "비밀번호 변경하기",
  });

  const form = submitButton.closest("form");
  if (!form) {
    throw new Error("reset password form을 찾을 수 없습니다.");
  }

  fireEvent.submit(form);
}
