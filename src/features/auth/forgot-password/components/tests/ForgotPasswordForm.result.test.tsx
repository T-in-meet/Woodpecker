import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_GLOBAL_ERROR_MESSAGE } from "@/features/auth/constants/messages";
import { RATE_LIMIT_TOAST_MESSAGE } from "@/features/auth/errors/rateLimitError";
import {
  FIXTURES,
  getEmailInput,
  renderForgotPasswordForm,
  resetToastMock,
  setupForgotPasswordFormTest,
  submitForm,
  typeValidEmail,
} from "@/features/auth/forgot-password/components/tests/utils/forgot-password-form-test-utils";
import { showToast } from "@/lib/utils/showToast";

import { FORGOT_PASSWORD_UI_MESSAGES } from "../../constants/messages";

describe("ForgotPasswordForm.result", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToastMock();
  });

  it("TC14: action success면 success toast를 표시한다", async () => {
    setupForgotPasswordFormTest({
      state: { status: "completed", fieldErrors: null },
    });

    renderForgotPasswordForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(FORGOT_PASSWORD_UI_MESSAGES.success);
  });

  it("TC15: success 후에도 input value를 유지한다", async () => {
    setupForgotPasswordFormTest({
      state: { status: "completed", fieldErrors: null },
    });
    renderForgotPasswordForm();

    await typeValidEmail();
    await submitForm();

    expect(getEmailInput()).toHaveValue(FIXTURES.valid);
  });

  it("TC16: internal_error 응답에서 global error를 폼 안에 남긴다", async () => {
    setupForgotPasswordFormTest({
      state: { status: "internal_error", fieldErrors: null },
    });

    renderForgotPasswordForm();

    // 재시도가 필요한 오류라 사라지는 toast가 아니라 폼 안에 남는다.
    expect(await screen.findByTestId("form-error")).toHaveTextContent(
      AUTH_GLOBAL_ERROR_MESSAGE,
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it("TC18: global error 이후에도 input value를 유지한다", async () => {
    setupForgotPasswordFormTest({
      state: { status: "internal_error", fieldErrors: null },
    });
    renderForgotPasswordForm();

    await typeValidEmail();

    expect(getEmailInput()).toHaveValue(FIXTURES.valid);
  });

  it("TC19: blocked 응답이면 rate limit 안내를 폼 안에 남긴다", async () => {
    setupForgotPasswordFormTest({
      state: { status: "blocked", fieldErrors: null },
    });

    renderForgotPasswordForm();

    expect(await screen.findByTestId("form-error")).toHaveTextContent(
      RATE_LIMIT_TOAST_MESSAGE,
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it("TC24: invalid_reset_link query면 toast를 1회 표시한다", () => {
    setupForgotPasswordFormTest({
      queryError: "invalid_reset_link",
    });

    renderForgotPasswordForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      FORGOT_PASSWORD_UI_MESSAGES.invalidResetLink,
    );
  });
});
