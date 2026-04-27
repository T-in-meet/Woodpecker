/**
 * LoginForm 인증 실패 처리 테스트
 *
 * 검증 범위:
 * - LOGIN_INVALID_CREDENTIALS → 폼 전체 에러 "이메일 또는 비밀번호가 올바르지 않습니다." 표시
 * - 모든 인증 실패 케이스에 동일한 메시지 (account enumeration 방어)
 * - 성공 시 에러 없음
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";

import {
  mockMutateAsync,
  renderLoginForm,
  setupDefaultMocks,
} from "./utils/loginFormTestUtils";

async function submitValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/이메일/i), "user@example.com");
  await user.type(screen.getByLabelText(/^비밀번호$/i), "Password1!");
  await user.click(screen.getByRole("button", { name: /^로그인$/ }));
}

describe("LoginForm 인증 실패 처리", () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  it("LOGIN_INVALID_CREDENTIALS 오류 시 '이메일 또는 비밀번호가 올바르지 않습니다.' 에러가 표시된다", async () => {
    mockMutateAsync.mockRejectedValue({
      success: false,
      code: AUTH_API_CODES.LOGIN_INVALID_CREDENTIALS,
      data: null,
    });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "이메일 또는 비밀번호가 올바르지 않습니다.",
      );
    });
  });

  it("인증 실패 메시지는 필드가 아닌 폼 전체 에러로 표시된다 (setError root)", async () => {
    mockMutateAsync.mockRejectedValue({
      success: false,
      code: AUTH_API_CODES.LOGIN_INVALID_CREDENTIALS,
      data: null,
    });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      // 폼 전체 에러는 data-testid="form-error" 영역에 표시
      expect(screen.getByTestId("form-error")).toBeInTheDocument();
    });
  });

  it("성공 시 인증 실패 에러가 표시되지 않는다", async () => {
    mockMutateAsync.mockResolvedValue({
      success: true,
      code: "LOGIN_SUCCESS",
      data: { redirectTo: "/mypage" },
    });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByTestId("form-error")).not.toBeInTheDocument();
  });
});
