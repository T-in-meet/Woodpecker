/**
 * LoginForm 전역 에러 처리 테스트
 *
 * 검증 범위:
 * - network/server/timeout 에러 → showToast 호출
 * - rate limit 에러 → showToast 호출
 * - 알 수 없는 에러 → showToast 호출
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { showToast } from "@/lib/utils/showToast";

import {
  mockMutateAsync,
  renderLoginForm,
  setupDefaultMocks,
} from "./utils/loginFormTestUtils";

vi.mock("@/lib/utils/showToast", () => ({ showToast: vi.fn() }));

async function submitValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/이메일/i), "user@example.com");
  await user.type(screen.getByLabelText(/^비밀번호$/i), "Password1!");
  await user.click(screen.getByRole("button", { name: /^로그인$/ }));
}

describe("LoginForm 전역 에러 처리", () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  it("network 에러가 발생하면 showToast가 호출된다", async () => {
    mockMutateAsync.mockRejectedValue({ type: "network" });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "네트워크 연결을 확인해주세요",
        "destructive",
      );
    });
  });

  it("server 에러가 발생하면 showToast가 호출된다", async () => {
    mockMutateAsync.mockRejectedValue({ type: "server" });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "잠시 후 다시 시도해주세요",
        "destructive",
      );
    });
  });

  it("timeout 에러가 발생하면 showToast가 호출된다", async () => {
    mockMutateAsync.mockRejectedValue({ type: "timeout" });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "요청 시간이 초과되었습니다. 다시 시도해주세요",
        "destructive",
      );
    });
  });

  it("rate limit 에러가 발생하면 showToast가 호출된다", async () => {
    mockMutateAsync.mockRejectedValue({
      success: false,
      code: AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED,
      data: null,
    });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("요청이 너무 많습니다"),
        "destructive",
      );
    });
  });

  it("알 수 없는 에러가 발생하면 일시적인 오류 toast가 호출된다", async () => {
    mockMutateAsync.mockRejectedValue(new Error("unexpected"));
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "일시적인 오류가 발생했습니다.",
        "destructive",
      );
    });
  });
});
