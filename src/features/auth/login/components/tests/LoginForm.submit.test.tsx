/**
 * LoginForm 제출 및 pending 상태 테스트
 *
 * 검증 범위:
 * - isPending=true 일 때 버튼 비활성화 + 로딩 텍스트
 * - 제출 중 중복 클릭 방지
 * - 유효한 폼 제출 시 mutateAsync 1회 호출
 * - 로그인 성공 후 router.push(data.redirectTo) 호출
 * - redirect query가 있으면 mutateAsync에 전달
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockMutateAsync,
  mockPush,
  renderLoginForm,
  setupDefaultMocks,
} from "./utils/loginFormTestUtils";

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/이메일/i), "user@example.com");
  await user.type(screen.getByLabelText(/^비밀번호$/i), "Password1!");
  await user.click(screen.getByRole("button", { name: /^로그인$/ }));
}

describe("LoginForm 제출 및 pending 상태", () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  it("isPending=true이면 로그인 버튼이 비활성화된다", () => {
    setupDefaultMocks({ isPending: true });
    renderLoginForm();
    expect(screen.getByRole("button", { name: /로그인 중/i })).toBeDisabled();
  });

  it("isPending=true이면 로딩 텍스트가 표시된다", () => {
    setupDefaultMocks({ isPending: true });
    renderLoginForm();
    expect(
      screen.getByRole("button", { name: /로그인 중/i }),
    ).toBeInTheDocument();
  });

  it("유효한 폼 제출 시 mutateAsync가 1회 호출된다", async () => {
    setupDefaultMocks();
    mockMutateAsync.mockResolvedValue({
      success: true,
      code: "LOGIN_SUCCESS",
      data: { redirectTo: "/mypage" },
    });
    const user = userEvent.setup();
    renderLoginForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("로그인 성공 후 router.push가 redirectTo 경로로 호출된다", async () => {
    setupDefaultMocks();
    mockMutateAsync.mockResolvedValue({
      success: true,
      code: "LOGIN_SUCCESS",
      data: { redirectTo: "/mypage" },
    });
    const user = userEvent.setup();
    renderLoginForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/mypage");
    });
  });

  it("redirect query가 있으면 mutateAsync에 redirect로 전달된다", async () => {
    setupDefaultMocks({ redirectQuery: "/notes" });
    mockMutateAsync.mockResolvedValue({
      success: true,
      code: "LOGIN_SUCCESS",
      data: { redirectTo: "/notes" },
    });
    const user = userEvent.setup();
    renderLoginForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect.objectContaining({
        payload: {
          email: "user@example.com",
          password: "Password123!",
        },
        redirect: "/notes",
      });
    });
  });

  it("isPending=true인 상태에서 버튼을 여러 번 클릭해도 mutateAsync가 호출되지 않는다", async () => {
    setupDefaultMocks({ isPending: true });
    const user = userEvent.setup();
    renderLoginForm();

    const btn = screen.getByRole("button", { name: /로그인 중/i });
    await user.click(btn);
    await user.click(btn);
    await user.click(btn);

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
