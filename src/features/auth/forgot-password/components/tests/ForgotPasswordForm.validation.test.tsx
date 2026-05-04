import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getFormActionMock,
  getSubmitButtonByDefaultLabel,
  renderForgotPasswordForm,
  resetToastMock,
  setupForgotPasswordFormTest,
  submitByFormEvent,
  submitForm,
  typeInvalidEmail,
  typeValidEmail,
} from "@/features/auth/forgot-password/components/tests/utils/forgot-password-form-test-utils";

describe("ForgotPasswordForm.validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToastMock();
    setupForgotPasswordFormTest();
  });

  it("TC5: empty submit이면 validation error를 표시하고 action 호출이 없다", async () => {
    renderForgotPasswordForm();

    submitByFormEvent();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(getFormActionMock()).not.toHaveBeenCalled();
  });

  it("TC6: invalid format submit이면 validation error를 표시하고 action 호출이 없다", async () => {
    renderForgotPasswordForm();
    await typeInvalidEmail();

    submitByFormEvent();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(getFormActionMock()).not.toHaveBeenCalled();
  });

  it("TC7: valid 입력이면 validation error가 없다", async () => {
    renderForgotPasswordForm();

    await typeValidEmail();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("TC9: invalid 상태에서도 버튼은 enabled다", async () => {
    renderForgotPasswordForm();
    await typeInvalidEmail();

    await submitForm();

    expect(getSubmitButtonByDefaultLabel()).toBeEnabled();
  });

  it("TC10: valid 상태에서는 버튼이 enabled다", async () => {
    renderForgotPasswordForm();

    await typeValidEmail();

    expect(getSubmitButtonByDefaultLabel()).toBeEnabled();
  });
});
