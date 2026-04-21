/**
 * LoginForm 서버 validation 에러 매핑 테스트
 *
 * 검증 범위:
 * - LOGIN_INVALID_INPUT + errors[email] → 이메일 필드 에러 표시
 * - LOGIN_INVALID_INPUT + errors[password] → 비밀번호 필드 에러 표시
 * - 알 수 없는 필드 → form-error 표시
 */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockMutateAsync,
  renderLoginForm,
  setupDefaultMocks,
} from "./utils/loginFormTestUtils";

vi.mock("next/navigation");
vi.mock("@/features/auth/login/hooks/useLoginMutation");

async function submitValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/이메일/i), "user@example.com");
  await user.type(screen.getByLabelText(/^비밀번호$/i), "Password1!");
  await user.click(screen.getByRole("button", { name: /^로그인$/ }));
}

describe("LoginForm 서버 validation 에러 매핑", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("email 필드 에러 반환 시 이메일 필드 아래에 에러가 표시된다", async () => {
    mockMutateAsync.mockRejectedValue({
      success: false,
      code: "LOGIN_INVALID_INPUT",
      data: { errors: [{ field: "email", reason: "INVALID_FORMAT" }] },
    });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    const emailField = screen.getByLabelText(/이메일/i).closest("div");
    expect(await within(emailField!).findByRole("alert")).toBeInTheDocument();
  });

  it("password 필드 에러 반환 시 비밀번호 필드 아래에 에러가 표시된다", async () => {
    mockMutateAsync.mockRejectedValue({
      success: false,
      code: "LOGIN_INVALID_INPUT",
      data: { errors: [{ field: "password", reason: "REQUIRED" }] },
    });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    const passwordField = screen.getByLabelText(/^비밀번호$/i).closest("div");
    expect(
      await within(passwordField!).findByRole("alert"),
    ).toBeInTheDocument();
  });

  it("알 수 없는 필드 에러 반환 시 필드 에러 없이 폼 수준 에러가 표시된다", async () => {
    mockMutateAsync.mockRejectedValue({
      success: false,
      code: "LOGIN_INVALID_INPUT",
      data: { errors: [{ field: "unknownField", reason: "INVALID" }] },
    });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      expect(screen.getByTestId("form-error")).toBeInTheDocument();
    });
  });
});
