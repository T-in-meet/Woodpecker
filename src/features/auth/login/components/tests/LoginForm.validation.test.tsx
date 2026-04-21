/**
 * LoginForm 클라이언트 validation 테스트
 *
 * 검증 범위:
 * - 이메일 형식 오류 시 제출 차단 + 에러 표시
 * - 비밀번호 미입력 시 제출 차단 + 에러 표시
 * - 제출 후 onChange 재검증 (reValidateMode)
 * - 검증 실패 시 mutateAsync 호출 안 됨
 * - 실패 후에도 입력값 유지
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockMutateAsync,
  renderLoginForm,
  setupDefaultMocks,
} from "./utils/loginFormTestUtils";

describe("LoginForm 클라이언트 validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("이메일 형식이 잘못되면 에러가 표시되고 mutateAsync가 호출되지 않는다", async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/이메일/i), "not-an-email");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "Password1!");
    await user.click(screen.getByRole("button", { name: /^로그인$/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("비밀번호가 비어 있으면 에러가 표시되고 mutateAsync가 호출되지 않는다", async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/이메일/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /^로그인$/ }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("제출 후 이메일을 수정하면 onChange 재검증이 실행된다", async () => {
    const user = userEvent.setup();
    renderLoginForm();

    // 잘못된 이메일로 먼저 제출
    await user.type(screen.getByLabelText(/이메일/i), "bad");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "Password1!");
    await user.click(screen.getByRole("button", { name: /^로그인$/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // 올바른 이메일로 수정하면 에러가 사라져야 함
    await user.clear(screen.getByLabelText(/이메일/i));
    await user.type(screen.getByLabelText(/이메일/i), "valid@example.com");

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("인증 실패 후에도 이메일 입력값이 유지된다", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValue({
      success: false,
      code: "LOGIN_INVALID_CREDENTIALS",
      data: null,
    });
    renderLoginForm();

    await user.type(screen.getByLabelText(/이메일/i), "user@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "Password1!");
    await user.click(screen.getByRole("button", { name: /^로그인$/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/이메일/i)).toHaveValue("user@example.com");
  });

  it("인증 실패 후에도 비밀번호 입력값이 유지된다", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValue({
      success: false,
      code: "LOGIN_INVALID_CREDENTIALS",
      data: null,
    });
    renderLoginForm();

    await user.type(screen.getByLabelText(/이메일/i), "user@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "Password1!");
    await user.click(screen.getByRole("button", { name: /^로그인$/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/^비밀번호$/i)).toHaveValue("Password1!");
  });
});
