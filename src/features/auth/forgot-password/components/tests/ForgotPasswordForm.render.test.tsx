import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getEmailInput,
  getSubmitButtonByDefaultLabel,
  MESSAGES,
  renderForgotPasswordForm,
  resetToastMock,
  setDefaultValidSafeParse,
  setupForgotPasswordFormTest,
} from "@/features/auth/forgot-password/components/tests/utils/forgot-password-form-test-utils";

describe("ForgotPasswordForm.render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToastMock();
    setupForgotPasswordFormTest();
    setDefaultValidSafeParse();
  });

  it("TC1: 초기 렌더링 시 email input, submit button이 존재한다", () => {
    renderForgotPasswordForm();

    expect(getEmailInput()).toBeInTheDocument();
    expect(getSubmitButtonByDefaultLabel()).toBeInTheDocument();
  });

  it('TC22: 초기 버튼 문구는 "비밀번호 재설정 메일 받기"다', () => {
    renderForgotPasswordForm();

    expect(getSubmitButtonByDefaultLabel()).toHaveTextContent(MESSAGES.submit);
  });
});
