import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSafeParseMock,
  MESSAGES,
  renderForgotPasswordForm,
  resetToastMock,
  setDefaultValidSafeParse,
  setInvalidSafeParse,
  setupForgotPasswordFormTest,
  typeInvalidEmail,
  typeValidEmail,
} from "@/features/auth/forgot-password/components/tests/utils/forgot-password-form-test-utils";

describe("ForgotPasswordForm.debounce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToastMock();
    setupForgotPasswordFormTest();
    setDefaultValidSafeParse();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("TC8: 빠른 입력에서는 즉시 validation이 없고 300ms 이후 실행된다", async () => {
    renderForgotPasswordForm();

    await typeValidEmail();

    expect(getSafeParseMock()).toHaveBeenCalledTimes(0);

    await act(async () => {
      vi.advanceTimersByTime(299);
    });

    expect(getSafeParseMock()).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(getSafeParseMock()).toHaveBeenCalledTimes(1);
  });

  it("TC19: invalid -> valid 변경 시 즉시 error 유지, 300ms 이후 제거된다", async () => {
    renderForgotPasswordForm();

    setInvalidSafeParse(MESSAGES.invalidFormat);
    await typeInvalidEmail();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(document.body).toHaveTextContent(MESSAGES.invalidFormat);

    setDefaultValidSafeParse();
    await typeValidEmail();

    expect(document.body).toHaveTextContent(MESSAGES.invalidFormat);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(document.body).not.toHaveTextContent(MESSAGES.invalidFormat);
  });
});
