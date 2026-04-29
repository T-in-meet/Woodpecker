import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fillResetPasswordFields,
  renderResetPasswordForm,
  setDefaultValidSafeParse,
  setIdleActionState,
} from "@/features/auth/reset-password/components/tests/utils/reset-password-form-test-utils";

const hoisted = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
  formActionMock: vi.fn(),
  safeParseMock: vi.fn(),
  changePasswordSafeParseMock: vi.fn(),
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

vi.mock("@/features/mypage/schema", () => ({
  changePasswordSchema: { safeParse: hoisted.changePasswordSafeParseMock },
}));

describe("reset-password-form validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setIdleActionState(hoisted.useActionStateMock, hoisted.formActionMock);
    setDefaultValidSafeParse(hoisted.safeParseMock);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("TC8: 입력 중 validation은 debounce(300ms)로 실행된다", () => {
    renderResetPasswordForm();
    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "valid-password",
    });

    expect(hoisted.safeParseMock).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(299);
    expect(hoisted.safeParseMock).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(hoisted.safeParseMock).toHaveBeenCalledTimes(1);
  });

  it("TC8-1: debounce 대기 중 입력이 변경되면 마지막 입력 기준으로만 validation 1회 실행된다", () => {
    renderResetPasswordForm();
    fillResetPasswordFields({
      password: "first-password",
      confirmPassword: "first-password",
    });

    vi.advanceTimersByTime(150);
    fillResetPasswordFields({
      password: "second-password",
      confirmPassword: "second-password",
    });

    vi.advanceTimersByTime(299);
    expect(hoisted.safeParseMock).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(hoisted.safeParseMock).toHaveBeenCalledTimes(1);
    expect(hoisted.safeParseMock).toHaveBeenLastCalledWith({
      password: "second-password",
      confirmPassword: "second-password",
    });
  });

  it("TC9: submit 시 debounce 없이 즉시 validation을 실행한다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderResetPasswordForm();
    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "valid-password",
    });

    await user.click(screen.getByRole("button", { name: "비밀번호 변경하기" }));
    expect(hoisted.safeParseMock).toHaveBeenCalled();
  });

  it("TC9-1: debounce 예약 상태에서 submit하면 즉시 validation 후 formAction 호출, 이후 timer로 중복 validation이 없다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderResetPasswordForm();
    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "valid-password",
    });

    expect(hoisted.safeParseMock).toHaveBeenCalledTimes(0);
    await user.click(screen.getByRole("button", { name: "비밀번호 변경하기" }));
    expect(hoisted.safeParseMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(hoisted.formActionMock).toHaveBeenCalledTimes(1);
    });

    vi.runOnlyPendingTimers();
    expect(hoisted.safeParseMock).toHaveBeenCalledTimes(1);
  });

  it("TC4/TC10/TC12: invalid 입력이면 field error를 표시하고 submit 차단한다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    hoisted.safeParseMock.mockReturnValue({
      success: false,
      error: {
        flatten: () => ({
          formErrors: [],
          fieldErrors: {
            password: ["비밀번호는 최소 8자 이상이어야 합니다."],
          },
        }),
      },
    });

    renderResetPasswordForm();
    fillResetPasswordFields({ password: "short", confirmPassword: "short" });
    vi.advanceTimersByTime(300);
    await user.click(screen.getByRole("button", { name: "비밀번호 변경하기" }));

    await waitFor(() => {
      expect(
        screen.getByText("비밀번호는 최소 8자 이상이어야 합니다."),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "비밀번호 변경하기" }),
    ).toBeDisabled();
    expect(hoisted.formActionMock).not.toHaveBeenCalled();
  });

  it("TC5/TC6/TC7: confirmPassword mismatch를 재검증해 에러를 표시한다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    hoisted.safeParseMock.mockReturnValue({
      success: false,
      error: {
        flatten: () => ({
          formErrors: [],
          fieldErrors: {
            confirmPassword: ["비밀번호가 일치하지 않습니다."],
          },
        }),
      },
    });

    renderResetPasswordForm();
    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "different-password",
    });
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(
        screen.getByText("비밀번호가 일치하지 않습니다."),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^비밀번호$/i), {
      target: { value: "changed-password" },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인/i), {
      target: { value: "different-password" },
    });
    vi.advanceTimersByTime(300);
    await user.click(screen.getByRole("button", { name: "비밀번호 변경하기" }));
    expect(hoisted.formActionMock).not.toHaveBeenCalled();
  });

  it("TC19-1: server field_error 이후 client error가 생기면 client error만 우선 표시한다", async () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "field_error",
        fieldErrors: { confirmPassword: ["서버 불일치 에러"] },
      },
      hoisted.formActionMock,
      false,
    ]);
    hoisted.safeParseMock.mockReturnValue({
      success: false,
      error: {
        flatten: () => ({
          formErrors: [],
          fieldErrors: {
            password: ["클라이언트 비밀번호 에러"],
          },
        }),
      },
    });

    renderResetPasswordForm();
    expect(screen.getByText("서버 불일치 에러")).toBeInTheDocument();

    fillResetPasswordFields({
      password: "short",
      confirmPassword: "short",
    });
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText("클라이언트 비밀번호 에러")).toBeInTheDocument();
    });
    expect(screen.queryByText("서버 불일치 에러")).not.toBeInTheDocument();
  });

  it("TC11/TC13: valid 상태에서는 버튼 활성화 및 formActionMock 호출을 허용한다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderResetPasswordForm();
    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "valid-password",
    });
    vi.advanceTimersByTime(300);
    expect(
      screen.getByRole("button", { name: "비밀번호 변경하기" }),
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "비밀번호 변경하기" }));
    await waitFor(() => {
      expect(hoisted.formActionMock).toHaveBeenCalledTimes(1);
    });
  });

  it("TC26/TC27: resetPasswordFormSchema만 사용하고 최종 검증은 bind된 formAction에 위임한다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderResetPasswordForm();
    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "valid-password",
    });
    vi.advanceTimersByTime(300);
    await user.click(screen.getByRole("button", { name: "비밀번호 변경하기" }));

    expect(hoisted.safeParseMock).toHaveBeenCalled();
    expect(hoisted.changePasswordSafeParseMock).not.toHaveBeenCalled();
    expect(hoisted.formActionMock).toHaveBeenCalled();
  });
});
