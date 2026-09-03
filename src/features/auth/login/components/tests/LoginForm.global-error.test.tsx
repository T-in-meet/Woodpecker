/**
 * LoginForm 전역 에러 처리 테스트
 *
 * 검증 범위:
 * - network/server/timeout 에러 → 폼 안에 남는 오류 문구
 * - rate limit 에러 → 폼 안에 남는 오류 문구
 * - 알 수 없는 에러 → 폼 안에 남는 오류 문구
 * - OAuth callback 실패 query → toast (폼 제출 결과가 아니라 도착 시 알림)
 *
 * 재시도가 필요한 오류는 사라지는 toast가 아니라 자격증명 오류와 같은 자리
 * (data-testid="form-error")에 남는다. 그래서 이 파일은 showToast 호출이 아니라
 * 화면에 보이는 문구를 검증한다.
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import {
  OAUTH_CALLBACK_ERROR_REASON,
  OAUTH_CALLBACK_ERROR_TOAST_KEY,
  OAUTH_CALLBACK_ERROR_TOAST_MESSAGE,
} from "@/features/auth/constants/oauthCallbackError";
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

/**
 * 폼 안에 오류 문구가 남았는지 확인한다.
 *
 * @param message 기대하는 오류 문구(부분 일치)
 */
async function expectFormError(message: string | RegExp) {
  const formError = await screen.findByTestId("form-error");

  expect(formError).toHaveTextContent(message);
  expect(showToast).not.toHaveBeenCalled();
}

describe("LoginForm 전역 에러 처리", () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  it("network 에러가 발생하면 폼 안에 오류 문구가 남는다", async () => {
    mockMutateAsync.mockRejectedValue({ type: "network" });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await expectFormError("네트워크 연결을 확인해주세요");
  });

  it("server 에러가 발생하면 폼 안에 오류 문구가 남는다", async () => {
    mockMutateAsync.mockRejectedValue({ type: "server" });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await expectFormError("잠시 후 다시 시도해주세요");
  });

  it("timeout 에러가 발생하면 폼 안에 오류 문구가 남는다", async () => {
    mockMutateAsync.mockRejectedValue({ type: "timeout" });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await expectFormError("요청 시간이 초과되었습니다. 다시 시도해주세요");
  });

  it("rate limit 에러가 발생하면 폼 안에 오류 문구가 남는다", async () => {
    mockMutateAsync.mockRejectedValue({
      success: false,
      code: AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED,
      data: null,
    });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await expectFormError(/요청이 너무 많습니다/);
  });

  it("알 수 없는 에러가 발생하면 폼 안에 오류 문구가 남는다", async () => {
    mockMutateAsync.mockRejectedValue(new Error("unexpected"));
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await expectFormError("일시적인 오류가 발생했습니다.");
  });

  it("OAuth callback 실패 query가 있으면 소셜 로그인 실패 toast를 표시한다", async () => {
    setupDefaultMocks({
      oauthError: OAUTH_CALLBACK_ERROR_REASON.EXCHANGE_FAILED,
    });

    renderLoginForm();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        OAUTH_CALLBACK_ERROR_TOAST_MESSAGE,
        {
          variant: "destructive",
          dedupeKey: OAUTH_CALLBACK_ERROR_TOAST_KEY,
        },
      );
    });
  });
});
