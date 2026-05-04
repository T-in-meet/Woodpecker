import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PASSWORD_MIN_LENGTH_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
} from "@/features/auth/constants/messages";
import { INPUT_DEBOUNCE_DELAY_MS } from "@/features/auth/constants/ui";
import {
  fillResetPasswordFields,
  renderResetPasswordForm,
  setDefaultValidSafeParse,
  setIdleActionState,
  submitResetPasswordForm,
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

  it("TC9-1: debounce 예약 상태에서 submit하면 즉시 validation 후 formAction을 호출한다", async () => {
    renderResetPasswordForm();

    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "valid-password",
    });

    submitResetPasswordForm();

    expect(hoisted.safeParseMock).toHaveBeenCalledTimes(1);
    expect(hoisted.formActionMock).toHaveBeenCalledTimes(1);
  });

  it("TC4/TC10/TC12: invalid 입력이면 field error를 표시하고 submit 차단한다", async () => {
    hoisted.safeParseMock.mockReturnValue({
      success: false,
      error: {
        flatten: () => ({
          formErrors: [],
          fieldErrors: {
            password: [PASSWORD_MIN_LENGTH_MESSAGE],
          },
        }),
      },
    });

    renderResetPasswordForm();
    fillResetPasswordFields({ password: "short", confirmPassword: "short" });
    act(() => {
      vi.advanceTimersByTime(INPUT_DEBOUNCE_DELAY_MS);
    });
    submitResetPasswordForm();

    expect(screen.getByText(PASSWORD_MIN_LENGTH_MESSAGE)).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "비밀번호 변경하기" }),
    ).toBeDisabled();
    expect(hoisted.formActionMock).not.toHaveBeenCalled();
  });

  it("TC5/TC6/TC7: confirmPassword mismatch를 재검증해 에러를 표시한다", async () => {
    hoisted.safeParseMock.mockReturnValue({
      success: false,
      error: {
        flatten: () => ({
          formErrors: [],
          fieldErrors: {
            confirmPassword: [PASSWORD_MISMATCH_MESSAGE],
          },
        }),
      },
    });

    renderResetPasswordForm();
    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "different-password",
    });

    act(() => {
      vi.advanceTimersByTime(INPUT_DEBOUNCE_DELAY_MS);
    });

    expect(screen.getByText(PASSWORD_MISMATCH_MESSAGE)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^비밀번호$/i), {
      target: { value: "changed-password" },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인/i), {
      target: { value: "different-password" },
    });
    act(() => {
      vi.advanceTimersByTime(INPUT_DEBOUNCE_DELAY_MS);
    });
    submitResetPasswordForm();
    expect(hoisted.formActionMock).not.toHaveBeenCalled();
  });

  it("TC19-1: server invalid_input 이후 client error가 생기면 client error만 우선 표시한다", async () => {
    hoisted.useActionStateMock.mockReturnValue([
      {
        status: "invalid_input",
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

    act(() => {
      vi.advanceTimersByTime(INPUT_DEBOUNCE_DELAY_MS);
    });

    expect(screen.getByText("클라이언트 비밀번호 에러")).toBeInTheDocument();
    expect(screen.queryByText("서버 불일치 에러")).not.toBeInTheDocument();
  });

  it("TC11/TC13: valid 상태에서는 버튼 활성화 및 formActionMock 호출을 허용한다", async () => {
    renderResetPasswordForm();
    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "valid-password",
    });
    act(() => {
      vi.advanceTimersByTime(INPUT_DEBOUNCE_DELAY_MS);
    });
    expect(
      screen.getByRole("button", { name: "비밀번호 변경하기" }),
    ).toBeEnabled();

    submitResetPasswordForm();

    expect(hoisted.formActionMock).toHaveBeenCalledTimes(1);
  });

  it("TC26/TC27: resetPasswordFormSchema만 사용하고 최종 검증은 bind된 formAction에 위임한다", async () => {
    renderResetPasswordForm();
    fillResetPasswordFields({
      password: "valid-password",
      confirmPassword: "valid-password",
    });
    act(() => {
      vi.advanceTimersByTime(INPUT_DEBOUNCE_DELAY_MS);
    });
    submitResetPasswordForm();

    expect(hoisted.safeParseMock).toHaveBeenCalled();
    expect(hoisted.changePasswordSafeParseMock).not.toHaveBeenCalled();
    expect(hoisted.formActionMock).toHaveBeenCalled();
  });
});
