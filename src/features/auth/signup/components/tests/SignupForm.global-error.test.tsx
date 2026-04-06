import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SignupForm } from "../SignupForm";
import { renderSignupForm } from "./utils/signupFormTestUtils";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

// SignupForm 전역 에러 처리 테스트
// - 필드 단위 validation 에러가 아닌 network/server/timeout 에러의 전역 UI를 검증한다.
// - submit 실패 후 loading 해제, 입력값 유지, 재제출 시 기존 전역 에러 제거까지 확인한다.
// - 이 파일의 목적은 "전역 실패 상태에서도 폼 UX가 깨지지 않는지"를 검증하는 것이다.

// 전역 에러 fixture
// - 네트워크/서버/타임아웃 시나리오를 고정 값으로 정의한다.
const networkError = { type: "network" as const };
const serverError = { type: "server" as const };
const timeoutError = { type: "timeout" as const };

// TC-01 ~ TC-07: 전역 에러 UI 및 실패 후 상태 복구
describe("회원가입 전역 에러 처리", () => {
  async function fillValidForm(
    user: ReturnType<typeof userEvent.setup>,
    {
      email = "test@example.com",
      password = "12345678",
      confirmPassword = "12345678",
      nickname = "tester",
    }: {
      email?: string;
      password?: string;
      confirmPassword?: string;
      nickname?: string;
    } = {},
  ) {
    await user.type(screen.getByLabelText(/이메일/i), email);
    await user.type(screen.getByLabelText(/^비밀번호$/i), password);
    await user.type(screen.getByLabelText(/비밀번호 확인/i), confirmPassword);
    await user.type(screen.getByLabelText(/닉네임/i), nickname);
    await user.click(screen.getByRole("checkbox", { name: /이용약관/i }));
    await user.click(screen.getByRole("checkbox", { name: /개인정보/i }));
  }

  async function submitValidForm(
    user: ReturnType<typeof userEvent.setup>,
    values?: Parameters<typeof fillValidForm>[1],
  ) {
    await fillValidForm(user, values);
    await user.click(screen.getByRole("button", { name: /회원가입/i }));
  }

  it("TC-01: network 에러가 발생하면 상단 전역 에러 UI를 표시한다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(networkError);
    renderSignupForm({ onSubmit });

    await submitValidForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "네트워크 연결을 확인해주세요",
    );
  });

  it("TC-02: server 에러가 발생하면 상단 전역 에러 UI를 표시한다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(serverError);
    renderSignupForm({ onSubmit });

    await submitValidForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "잠시 후 다시 시도해주세요",
    );
  });

  it("TC-03: timeout 에러가 발생하면 상단 전역 에러 UI를 표시한다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(timeoutError);
    renderSignupForm({ onSubmit });

    await submitValidForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "요청 시간이 초과되었습니다. 다시 시도해주세요",
    );
  });

  it("TC-04: submit 실패 후 UI가 loading 상태에 고정되지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(serverError);
    const { rerender } = renderSignupForm({ onSubmit, isPending: true });

    expect(screen.getByRole("button", { name: /가입 중/i })).toBeDisabled();
    expect(screen.getByRole("status")).toBeInTheDocument();

    rerender(<SignupForm onSubmit={onSubmit} isPending={false} />);

    await submitValidForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "잠시 후 다시 시도해주세요",
    );
    expect(
      screen.getByRole("button", { name: /^회원가입$/ }),
    ).not.toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("TC-05: submit 실패 후에도 입력값이 유지된다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(networkError);
    renderSignupForm({ onSubmit });

    await submitValidForm(user, {
      email: "test@example.com",
      password: "12345678",
      confirmPassword: "12345678",
      nickname: "tester",
    });

    await screen.findByRole("alert");

    expect(screen.getByLabelText(/이메일/i)).toHaveValue("test@example.com");
    expect(screen.getByLabelText(/^비밀번호$/i)).toHaveValue("12345678");
    expect(screen.getByLabelText(/비밀번호 확인/i)).toHaveValue("12345678");
    expect(screen.getByLabelText(/닉네임/i)).toHaveValue("tester");
  });

  it("TC-06: validation 에러는 필드 에러로만 표시되고 전역 에러 UI는 표시하지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue({
      success: false as const,
      code: "AUTH_INVALID_INPUT",
      data: {
        errors: [
          { field: "email", reason: "INVALID_FORMAT" },
          { field: "nickname", reason: "REQUIRED" },
        ],
      },
    });
    renderSignupForm({ onSubmit });

    await submitValidForm(user);

    const emailField = screen.getByLabelText(/이메일/i).closest("div");
    const nicknameField = screen.getByLabelText(/닉네임/i).closest("div");

    expect(await within(emailField!).findByRole("alert")).toBeInTheDocument();
    expect(within(nicknameField!).getByRole("alert")).toBeInTheDocument();
    expect(
      screen.queryByText("네트워크 연결을 확인해주세요"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("잠시 후 다시 시도해주세요"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("요청 시간이 초과되었습니다. 다시 시도해주세요"),
    ).not.toBeInTheDocument();
  });

  it("TC-07: 재제출 시 기존 전역 에러는 즉시 제거된다", async () => {
    const user = userEvent.setup();
    let resolveSecondSubmit: (() => void) | undefined;
    const secondSubmit = new Promise<void>((resolve) => {
      resolveSecondSubmit = resolve;
    });
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockImplementationOnce(() => secondSubmit);
    renderSignupForm({ onSubmit });

    await submitValidForm(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "네트워크 연결을 확인해주세요",
    );

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(
        screen.queryByText("네트워크 연결을 확인해주세요"),
      ).not.toBeInTheDocument();
    });

    resolveSecondSubmit?.();
  });
});
