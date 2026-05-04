import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getFormActionMock,
  getSubmitButtonByLoadingLabel,
  MESSAGES,
  renderForgotPasswordForm,
  resetToastMock,
  setDefaultValidSafeParse,
  setInvalidSafeParse,
  setPendingWithDeferredPromise,
  setupForgotPasswordFormTest,
  submitByFormEvent,
  submitForm,
  submitWithEnterKey,
  typeValidEmail,
} from "@/features/auth/forgot-password/components/tests/utils/forgot-password-form-test-utils";

describe("ForgotPasswordForm.submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToastMock();
  });

  it("TC11: valid submit이면 action이 1회 호출된다", async () => {
    setupForgotPasswordFormTest();
    setDefaultValidSafeParse();
    renderForgotPasswordForm();

    await typeValidEmail();
    await submitForm();

    expect(getFormActionMock()).toHaveBeenCalledTimes(1);
  });

  it("TC12: invalid submit이면 action이 호출되지 않는다", async () => {
    setupForgotPasswordFormTest();
    setInvalidSafeParse(MESSAGES.invalidFormat);
    renderForgotPasswordForm();

    submitByFormEvent();

    expect(getFormActionMock()).not.toHaveBeenCalled();
  });

  it("TC13: submit 중 버튼은 disabled + loading 상태다", async () => {
    setupForgotPasswordFormTest();
    setPendingWithDeferredPromise();
    setDefaultValidSafeParse();
    renderForgotPasswordForm();

    await typeValidEmail();
    await submitForm();

    expect(getSubmitButtonByLoadingLabel()).toBeDisabled();
  });

  it("TC20: email=valid에서 Enter submit 시 action 1회 호출", async () => {
    setupForgotPasswordFormTest();
    setDefaultValidSafeParse();
    renderForgotPasswordForm();

    await typeValidEmail();
    submitWithEnterKey();

    await waitFor(() => expect(getFormActionMock()).toHaveBeenCalledTimes(1));
  });

  it('TC23: submit 중 버튼 문구는 "전송 중..."이고 disabled다', async () => {
    setupForgotPasswordFormTest();
    setPendingWithDeferredPromise();
    setDefaultValidSafeParse();
    renderForgotPasswordForm();

    await typeValidEmail();

    expect(getSubmitButtonByLoadingLabel()).toHaveTextContent(MESSAGES.loading);
    expect(getSubmitButtonByLoadingLabel()).toBeDisabled();
  });
});
