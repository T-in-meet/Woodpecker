import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FIXTURES,
  getEmailInput,
  getFormActionMock,
  getSafeParseMock,
  MESSAGES,
  renderForgotPasswordForm,
  rerenderForgotPasswordForm,
  resetToastMock,
  setDefaultValidSafeParse,
  setInvalidSafeParse,
  setupForgotPasswordFormTest,
  submitForm,
  typeInvalidEmail,
} from "@/features/auth/forgot-password/components/tests/utils/forgot-password-form-test-utils";

describe("ForgotPasswordForm.prefill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToastMock();
    setDefaultValidSafeParse();
  });

  it("TC2: valid prefill은 input 초기값으로 반영된다", () => {
    setupForgotPasswordFormTest({ prefillEmail: FIXTURES.prefillValid });
    renderForgotPasswordForm();

    expect(getEmailInput()).toHaveValue(FIXTURES.prefillValid);
  });

  it("TC3: invalid prefill은 무시되어 빈 값으로 렌더링된다", () => {
    setupForgotPasswordFormTest({ prefillEmail: FIXTURES.prefillInvalid });
    setInvalidSafeParse(MESSAGES.invalidFormat);

    renderForgotPasswordForm();

    expect(getEmailInput()).toHaveValue("");
  });

  it("TC4: prefill은 최초 렌더링 시 1회만 적용된다", async () => {
    setupForgotPasswordFormTest({ prefillEmail: FIXTURES.prefillValid });
    const { rerender } = renderForgotPasswordForm();

    expect(getEmailInput()).toHaveValue(FIXTURES.prefillValid);

    setupForgotPasswordFormTest({ prefillEmail: "another@example.com" });
    rerenderForgotPasswordForm(rerender);

    expect(getEmailInput()).toHaveValue(FIXTURES.prefillValid);
  });

  it("TC21: valid prefill 이후 invalid로 수정하면 validation error를 표시하고 action 호출이 없다", async () => {
    setupForgotPasswordFormTest({ prefillEmail: FIXTURES.prefillValid });

    getSafeParseMock()
      .mockReturnValueOnce({
        success: true,
        data: { email: FIXTURES.prefillValid },
      })
      .mockReturnValue({
        success: false,
        error: {
          flatten: () => ({
            formErrors: [],
            fieldErrors: { email: [MESSAGES.invalidFormat] },
          }),
        },
      });

    renderForgotPasswordForm();

    expect(getEmailInput()).toHaveValue(FIXTURES.prefillValid);

    await typeInvalidEmail();
    await submitForm();

    expect(getFormActionMock()).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
