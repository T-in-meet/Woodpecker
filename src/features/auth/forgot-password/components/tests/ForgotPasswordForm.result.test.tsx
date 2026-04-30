import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FIXTURES,
  getEmailInput,
  MESSAGES,
  renderForgotPasswordForm,
  resetToastMock,
  setDefaultValidSafeParse,
  setupForgotPasswordFormTest,
  submitForm,
  typeValidEmail,
} from "@/features/auth/forgot-password/components/tests/utils/forgot-password-form-test-utils";
import { showToast } from "@/lib/utils/showToast";

describe("ForgotPasswordForm.result", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToastMock();
    setDefaultValidSafeParse();
  });

  it("TC14: action success면 success toast를 표시한다", async () => {
    setupForgotPasswordFormTest({
      state: { status: "success", fieldErrors: null },
    });

    renderForgotPasswordForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(MESSAGES.success);
  });

  it("TC15: success 후에도 input value를 유지한다", async () => {
    setupForgotPasswordFormTest({
      state: { status: "success", fieldErrors: null },
    });
    renderForgotPasswordForm();

    await typeValidEmail();
    await submitForm();

    expect(getEmailInput()).toHaveValue(FIXTURES.valid);
  });

  it("TC16: global_error 응답(정규화된 rate limit 포함)에서 global error toast를 표시한다", () => {
    setupForgotPasswordFormTest({
      state: { status: "global_error", fieldErrors: null },
    });

    renderForgotPasswordForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(MESSAGES.globalError);
  });

  it("TC18: global error 이후에도 input value를 유지한다", async () => {
    setupForgotPasswordFormTest({
      state: { status: "global_error", fieldErrors: null },
    });
    renderForgotPasswordForm();

    await typeValidEmail();

    expect(getEmailInput()).toHaveValue(FIXTURES.valid);
  });
  it("TC24: invalid_reset_link query면 toast를 1회 표시한다", () => {
    setupForgotPasswordFormTest({
      queryError: "invalid_reset_link",
    });

    renderForgotPasswordForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(MESSAGES.invalidResetLink);
  });
});
