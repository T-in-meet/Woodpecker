import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SignupForm } from "../SignupForm";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

// SignupForm 서버 유효성 검사 에러 매핑 테스트
// - 서버에서 반환한 validation error를 클라이언트 필드 에러로 올바르게 연결하는지 검증한다.
// - 중첩 필드(agreements.*), 다중 에러, 이전 에러 초기화, 알 수 없는 필드 fallback까지 포함한다.
// - 이 파일은 "서버 응답 -> 폼 에러 표시" 매핑 계약 검증이 목적이다.

// - 서버 validation 응답 시나리오를 고정 fixture로 정의한다.
const emailRequiredError = {
  success: false as const,
  code: "AUTH_INVALID_INPUT",
  data: { errors: [{ field: "email", reason: "REQUIRED" }] },
};

const nestedAgreementError = {
  success: false as const,
  code: "AUTH_INVALID_INPUT",
  data: {
    errors: [{ field: "agreements.termsOfService", reason: "NOT_AGREED" }],
  },
};

const multipleErrors = {
  success: false as const,
  code: "AUTH_INVALID_INPUT",
  data: {
    errors: [
      { field: "email", reason: "INVALID_FORMAT" },
      { field: "nickname", reason: "TOO_SHORT" },
    ],
  },
};

const unknownFieldError = {
  success: false as const,
  code: "AUTH_INVALID_INPUT",
  data: { errors: [{ field: "unknownField", reason: "INVALID" }] },
};

// TC-01 ~ TC-07: 서버 validation 에러 매핑
describe("서버 유효성 검사 에러 매핑", () => {
  async function fillValidFormAndSubmit(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");
    await user.type(screen.getByLabelText(/닉네임/i), "tester");
    await user.click(screen.getByRole("checkbox", { name: /이용약관/i }));
    await user.click(screen.getByRole("checkbox", { name: /개인정보/i }));
    await user.click(screen.getByRole("button", { name: /회원가입/i }));
  }

  async function renderAndSubmitWithServerError(serverError: unknown) {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(serverError);
    render(<SignupForm onSubmit={onSubmit} />);
    await fillValidFormAndSubmit(user);
    return { user, onSubmit };
  }

  it("TC-01: email REQUIRED 에러 반환 시 이메일 필드 아래에 에러가 표시된다", async () => {
    await renderAndSubmitWithServerError(emailRequiredError);

    const emailField = screen.getByLabelText(/이메일/i).closest("div");
    expect(await within(emailField!).findByRole("alert")).toBeInTheDocument();
  });

  it("TC-02: agreements.termsOfService 중첩 에러 반환 시 이용약관 체크박스 영역에 에러가 표시된다", async () => {
    await renderAndSubmitWithServerError(nestedAgreementError);

    const termsField = screen.getByTestId("terms-of-service-field");
    expect(await within(termsField).findByRole("alert")).toBeInTheDocument();
  });

  it("TC-03: email과 nickname 다중 에러 반환 시 두 필드 모두에 에러가 표시된다", async () => {
    await renderAndSubmitWithServerError(multipleErrors);

    const emailField = screen.getByLabelText(/이메일/i).closest("div");
    const nicknameField = screen.getByLabelText(/닉네임/i).closest("div");

    expect(await within(emailField!).findByRole("alert")).toBeInTheDocument();
    expect(within(nicknameField!).getByRole("alert")).toBeInTheDocument();
  });

  it("TC-04: 두 번째 제출 시 이전 에러가 초기화되고 새 에러로 교체된다", async () => {
    const user = userEvent.setup();
    const secondError = {
      success: false as const,
      code: "AUTH_INVALID_INPUT",
      data: { errors: [{ field: "nickname", reason: "TOO_SHORT" }] },
    };
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(emailRequiredError)
      .mockRejectedValueOnce(secondError);
    render(<SignupForm onSubmit={onSubmit} />);

    await fillValidFormAndSubmit(user);

    const emailField = screen.getByLabelText(/이메일/i).closest("div");
    expect(await within(emailField!).findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(within(emailField!).queryByRole("alert")).not.toBeInTheDocument();
    });

    const nicknameField = screen.getByLabelText(/닉네임/i).closest("div");
    expect(within(nicknameField!).getByRole("alert")).toBeInTheDocument();
  });

  it("TC-05: 알 수 없는 필드 에러 반환 시 필드 에러 없이 폼 수준 에러가 표시된다", async () => {
    await renderAndSubmitWithServerError(unknownFieldError);

    const emailField = screen.getByLabelText(/이메일/i).closest("div");
    const nicknameField = screen.getByLabelText(/닉네임/i).closest("div");
    const passwordField = screen.getByLabelText(/^비밀번호$/i).closest("div");

    await waitFor(() => {
      expect(within(emailField!).queryByRole("alert")).not.toBeInTheDocument();
      expect(
        within(nicknameField!).queryByRole("alert"),
      ).not.toBeInTheDocument();
      expect(
        within(passwordField!).queryByRole("alert"),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("form-error")).toBeInTheDocument();
  });

  it("TC-06: reason은 사용자 친화적인 메시지로 변환되어 표시되며 원본 reason 문자열은 렌더링되지 않는다", async () => {
    await renderAndSubmitWithServerError({
      success: false as const,
      code: "AUTH_INVALID_INPUT",
      data: { errors: [{ field: "password", reason: "TOO_SHORT" }] },
    });

    const passwordField = screen.getByLabelText(/^비밀번호$/i).closest("div");
    expect(
      await within(passwordField!).findByRole("alert"),
    ).toBeInTheDocument();
    expect(screen.queryByText("TOO_SHORT")).not.toBeInTheDocument();
  });

  it("TC-07: 다중 에러가 동시에 표시되며 서로 덮어쓰지 않는다", async () => {
    await renderAndSubmitWithServerError(multipleErrors);

    const emailField = screen.getByLabelText(/이메일/i).closest("div");
    const nicknameField = screen.getByLabelText(/닉네임/i).closest("div");

    await waitFor(() => {
      expect(within(emailField!).getByRole("alert")).toBeInTheDocument();
      expect(within(nicknameField!).getByRole("alert")).toBeInTheDocument();
    });
  });
});
