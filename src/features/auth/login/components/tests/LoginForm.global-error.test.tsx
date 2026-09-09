/**
 * LoginForm 전역 에러 처리 테스트
 *
 * 검증 범위:
 * - network/server/timeout 에러 → 폼 안에 남는 오류 문구
 * - rate limit 에러 → 폼 안에 남는 오류 문구
 * - 알 수 없는 에러 → 폼 안에 남는 오류 문구
 * - OAuth callback 실패 query → 폼 안에 남는 오류 문구
 * - SYSTEM root error → 입력 수정 시 유지
 * - SYSTEM root error → 실제 재요청 시작 시 제거
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
  OAUTH_CALLBACK_ERROR_MESSAGE,
  OAUTH_CALLBACK_ERROR_REASON,
} from "@/features/auth/constants/oauthCallbackError";
import { showToast } from "@/lib/utils/showToast";

import {
  mockMutateAsync,
  mockPush,
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

  it("SYSTEM root error는 이메일과 비밀번호를 수정해도 유지된다", async () => {
    mockMutateAsync.mockRejectedValue({ type: "network" });
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);
    await expectFormError("네트워크 연결을 확인해주세요");

    await user.type(screen.getByLabelText(/이메일/i), "x");

    expect(screen.getByTestId("form-error")).toHaveTextContent(
      "네트워크 연결을 확인해주세요",
    );

    await user.type(screen.getByLabelText(/^비밀번호$/i), "x");

    expect(screen.getByTestId("form-error")).toHaveTextContent(
      "네트워크 연결을 확인해주세요",
    );
  });

  it("SYSTEM root error는 실제 재요청을 시작하면 즉시 제거된다", async () => {
    mockMutateAsync.mockRejectedValueOnce({ type: "network" });

    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);
    await expectFormError("네트워크 연결을 확인해주세요");

    type LoginSuccess = {
      success: true;
      code: string;
      data: {
        redirectTo: string;
      };
    };

    let resolveRetry!: (value: LoginSuccess) => void;

    const retryPromise = new Promise<LoginSuccess>((resolve) => {
      resolveRetry = resolve;
    });

    mockMutateAsync.mockImplementationOnce(() => retryPromise);

    await user.click(screen.getByRole("button", { name: /^로그인$/ }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId("form-error")).not.toBeInTheDocument();
    });

    resolveRetry({
      success: true,
      code: "LOGIN_SUCCESS",
      data: { redirectTo: "/mypage" },
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/mypage");
    });
  });

  it("OAuth callback 실패 query가 있으면 폼 안에 오류 문구가 남는다", async () => {
    setupDefaultMocks({
      oauthError: OAUTH_CALLBACK_ERROR_REASON.EXCHANGE_FAILED,
    });

    renderLoginForm();

    await expectFormError(OAUTH_CALLBACK_ERROR_MESSAGE);
  });

  it("OAuth callback SYSTEM root error는 입력을 수정해도 유지된다", async () => {
    setupDefaultMocks({
      oauthError: OAUTH_CALLBACK_ERROR_REASON.EXCHANGE_FAILED,
    });
    const user = userEvent.setup();

    renderLoginForm();
    await screen.findByTestId("form-error");

    await user.type(screen.getByLabelText("이메일"), "a");

    expect(screen.getByTestId("form-error")).toHaveTextContent(
      OAUTH_CALLBACK_ERROR_MESSAGE,
    );
  });
});
