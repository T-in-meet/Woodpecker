import { fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FIXTURES,
  getEmailInput,
  getFormActionMock,
  getSubmitButtonByLoadingLabel,
  renderForgotPasswordForm,
  resetToastMock,
  setPendingWithDeferredPromise,
  setupForgotPasswordFormTest,
  submitByFormEvent,
  submitForm,
  submitWithEnterKey,
  typeValidEmail,
} from "@/features/auth/forgot-password/components/tests/utils/forgot-password-form-test-utils";

import { FORGOT_PASSWORD_LABEL_MESSAGES } from "../../constants/messages";

describe("ForgotPasswordForm.submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToastMock();
  });

  it("TC11: valid submit이면 action이 1회 호출된다", async () => {
    setupForgotPasswordFormTest();
    renderForgotPasswordForm();

    await typeValidEmail();
    await submitForm();

    expect(getFormActionMock()).toHaveBeenCalledTimes(1);
    const payload = getFormActionMock().mock.calls[0]?.[0] as FormData;
    expect(payload).toBeInstanceOf(FormData);
    expect(payload.get("email")).toBe(FIXTURES.valid);
  });

  it("TC11-1: 공백 포함 이메일 submit이면 trim된 값이 FormData로 전달된다", async () => {
    setupForgotPasswordFormTest();
    renderForgotPasswordForm();

    const input = getEmailInput();
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("email input not found");
    }
    fireEvent.change(input, { target: { value: FIXTURES.validWithSpaces } });
    await submitForm();

    expect(getFormActionMock()).toHaveBeenCalledTimes(1);
    const payload = getFormActionMock().mock.calls[0]?.[0] as FormData;
    expect(payload.get("email")).toBe(FIXTURES.valid);
  });

  it("TC12: invalid submit이면 action이 호출되지 않는다", async () => {
    setupForgotPasswordFormTest();
    renderForgotPasswordForm();

    submitByFormEvent();

    expect(getFormActionMock()).not.toHaveBeenCalled();
  });

  it("TC13: submit 중 버튼은 disabled + loading 상태다", async () => {
    setupForgotPasswordFormTest();
    setPendingWithDeferredPromise();
    renderForgotPasswordForm();

    await typeValidEmail();
    await submitForm();

    expect(getSubmitButtonByLoadingLabel()).toBeDisabled();
  });

  it("TC20: email=valid에서 Enter submit 시 action 1회 호출", async () => {
    setupForgotPasswordFormTest();
    renderForgotPasswordForm();

    await typeValidEmail();
    submitWithEnterKey();

    await waitFor(() => expect(getFormActionMock()).toHaveBeenCalledTimes(1));
  });

  it('TC23: submit 중 버튼 문구는 "전송 중..."이고 disabled다', async () => {
    setupForgotPasswordFormTest();
    setPendingWithDeferredPromise();
    renderForgotPasswordForm();

    await typeValidEmail();

    expect(getSubmitButtonByLoadingLabel()).toHaveTextContent(
      FORGOT_PASSWORD_LABEL_MESSAGES.loading,
    );
    expect(getSubmitButtonByLoadingLabel()).toBeDisabled();
  });
});
