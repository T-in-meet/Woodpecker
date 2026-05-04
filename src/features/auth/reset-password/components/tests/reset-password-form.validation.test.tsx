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

describe("reset-password-form validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setIdleActionState(hoisted.useActionStateMock, hoisted.formActionMock);
  });

  it("TC4/TC10/TC12: invalid submit이면 field error를 표시하고 action 호출을 차단한다", async () => {
    renderResetPasswordForm();

    fillResetPasswordFields({
      password: "short",
      confirmPassword: "short",
    });

    submitResetPasswordForm();

    expect(
      await screen.findByText(PASSWORD_MIN_LENGTH_MESSAGE),
    ).toBeInTheDocument();
    expect(hoisted.formActionMock).not.toHaveBeenCalled();
  });

  it("TC5/TC6/TC7: confirmPassword mismatch이면 field error를 표시하고 action 호출을 차단한다", async () => {
    renderResetPasswordForm();

    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "different-password",
    });

    submitResetPasswordForm();

    expect(
      await screen.findByText(PASSWORD_MISMATCH_MESSAGE),
    ).toBeInTheDocument();
    expect(hoisted.formActionMock).not.toHaveBeenCalled();
  });

  it("TC9-1/TC11/TC13: valid submit이면 즉시 formAction을 호출한다", async () => {
    renderResetPasswordForm();

    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "valid-password",
    });

    submitResetPasswordForm();

    await waitFor(() => {
      expect(hoisted.formActionMock).toHaveBeenCalledTimes(1);
    });
  });

  it("TC19-1: server invalid_input 이후 client error가 생기면 client error를 우선 표시한다", async () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "invalid_input",
        fieldErrors: { confirmPassword: ["서버 불일치 에러"] },
      },
      hoisted.formActionMock,
      false,
    ]);

    renderResetPasswordForm();

    expect(screen.getByText("서버 불일치 에러")).toBeInTheDocument();

    fillResetPasswordFields({
      password: "short",
      confirmPassword: "short",
    });

    submitResetPasswordForm();

    expect(
      await screen.findByText(PASSWORD_MIN_LENGTH_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.queryByText("서버 불일치 에러")).not.toBeInTheDocument();
  });
});
