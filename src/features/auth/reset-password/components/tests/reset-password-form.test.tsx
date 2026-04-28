import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderResetPasswordForm,
  RESET_PASSWORD_GLOBAL_ERROR_MESSAGE_FIXTURE,
  setDefaultValidSafeParse,
  setIdleActionState,
} from "@/features/auth/reset-password/components/tests/utils/reset-password-form-test-utils";

const hoisted = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
  formActionMock: vi.fn(),
  safeParseMock: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: hoisted.useActionStateMock,
  };
});

vi.mock(
  "@/features/auth/reset-password/schemas/resetPasswordFormSchema",
  () => ({
    resetPasswordFormSchema: { safeParse: hoisted.safeParseMock },
  }),
);

describe("reset-password-form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setIdleActionState(hoisted.useActionStateMock, hoisted.formActionMock);
    setDefaultValidSafeParse(hoisted.safeParseMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("TC1/TC2: 기본 렌더링과 기본 버튼 문구를 표시한다", () => {
    renderResetPasswordForm(hoisted.formActionMock);
    expect(screen.getByLabelText(/^비밀번호$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/비밀번호 확인/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "비밀번호 변경하기" }),
    ).toBeInTheDocument();
  });

  it("TC3: pending 상태면 버튼 문구와 disabled를 반영한다", () => {
    hoisted.useActionStateMock.mockReturnValue([
      { status: "idle" },
      hoisted.formActionMock,
      true,
    ]);
    renderResetPasswordForm(hoisted.formActionMock);
    expect(screen.getByRole("button", { name: "변경 중..." })).toBeDisabled();
  });

  it("TC14/TC15/TC16/TC17: submit payload는 password/confirmPassword만 포함하고 redirect hidden input이 없다", async () => {
    const user = userEvent.setup();
    const { container } = renderResetPasswordForm(hoisted.formActionMock);

    await user.type(screen.getByLabelText(/^비밀번호$/i), "valid-password");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "valid-password");
    await user.click(screen.getByRole("button", { name: "비밀번호 변경하기" }));

    await waitFor(() => {
      expect(hoisted.formActionMock).toHaveBeenCalledTimes(1);
    });
    const payload = hoisted.formActionMock.mock.calls[0]?.[0] as FormData;
    expect(payload.get("password")).toBe("valid-password");
    expect(payload.get("confirmPassword")).toBe("valid-password");
    expect(payload.has("redirect")).toBe(false);
    expect(
      container.querySelector('input[type="hidden"][name="redirect"]'),
    ).toBeNull();
  });

  it("TC18: action state password field_error를 표시한다", () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "field_error",
        fieldErrors: { password: ["비밀번호는 최소 8자 이상이어야 합니다."] },
      },
      hoisted.formActionMock,
      false,
    ]);
    renderResetPasswordForm(hoisted.formActionMock);
    expect(
      screen.getByText("비밀번호는 최소 8자 이상이어야 합니다."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE_FIXTURE),
    ).not.toBeInTheDocument();
  });

  it("TC19: action state confirmPassword field_error를 표시한다", () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "field_error",
        fieldErrors: { confirmPassword: ["비밀번호가 일치하지 않습니다."] },
      },
      hoisted.formActionMock,
      false,
    ]);
    renderResetPasswordForm(hoisted.formActionMock);
    expect(
      screen.getByText("비밀번호가 일치하지 않습니다."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE_FIXTURE),
    ).not.toBeInTheDocument();
  });

  it("TC20/TC21: action state global_error는 global 영역에만 표시한다", () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "global_error",
        message: RESET_PASSWORD_GLOBAL_ERROR_MESSAGE_FIXTURE,
      },
      hoisted.formActionMock,
      false,
    ]);
    renderResetPasswordForm(hoisted.formActionMock);
    expect(
      screen.getByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE_FIXTURE),
    ).toBeInTheDocument();
    expect(screen.queryByText("supabase error")).not.toBeInTheDocument();
  });

  it("TC22: idle에서는 global error UI를 표시하지 않는다", async () => {
    const user = userEvent.setup();
    renderResetPasswordForm(hoisted.formActionMock);
    await user.type(screen.getByLabelText(/^비밀번호$/i), "secret-value");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "secret-value");

    expect(
      screen.queryByText(RESET_PASSWORD_GLOBAL_ERROR_MESSAGE_FIXTURE),
    ).not.toBeInTheDocument();
  });

  it("TC23: idle에서는 입력한 민감값을 화면 텍스트로 노출하지 않는다", async () => {
    const user = userEvent.setup();
    renderResetPasswordForm(hoisted.formActionMock);
    await user.type(screen.getByLabelText(/^비밀번호$/i), "secret-value");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "secret-value");

    expect(screen.queryByText("secret-value")).not.toBeInTheDocument();
  });

  it("TC24: idle에서는 성공 UI를 표시하지 않는다", async () => {
    const user = userEvent.setup();
    renderResetPasswordForm(hoisted.formActionMock);
    await user.type(screen.getByLabelText(/^비밀번호$/i), "secret-value");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "secret-value");

    expect(screen.queryByText(/변경 완료|성공/i)).not.toBeInTheDocument();
  });

  it("TC25: idle에서는 rejected UI를 표시하지 않는다", async () => {
    const user = userEvent.setup();
    renderResetPasswordForm(hoisted.formActionMock);
    await user.type(screen.getByLabelText(/^비밀번호$/i), "secret-value");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "secret-value");

    expect(screen.queryByText(/거부|rejected/i)).not.toBeInTheDocument();
  });
});
