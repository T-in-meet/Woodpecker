import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useActionState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResendEmailActionState } from "../resend-email/actions/resendEmailActionState";
import AuthEmailForm from "./AuthEmailForm";

vi.mock("../hooks/useAuthEmailPrefill", () => ({
  useAuthEmailPrefill: vi.fn(),
}));

vi.mock("../hooks/useAuthEmailActionEffect", () => ({
  useAuthEmailActionEffect: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: vi.fn(),
  };
});

const mockUseActionState = vi.mocked(useActionState);

const mockFormAction = vi.fn();

const initialState: ResendEmailActionState = {
  status: "idle",
  fieldErrors: null,
};

const action = vi.fn(
  async (
    _prevState: ResendEmailActionState,
    _formData: FormData,
  ): Promise<ResendEmailActionState> => initialState,
);

describe("AuthEmailForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseActionState.mockReturnValue([initialState, mockFormAction, false]);
  });

  it("이메일 입력 필드와 버튼을 렌더링한다", () => {
    render(
      <AuthEmailForm
        action={action}
        initialState={initialState}
        email={undefined}
        purpose="signup"
      />,
    );

    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "인증 번호 다시 받기" }),
    ).toBeInTheDocument();
  });

  it("purpose가 reset-password이면 비밀번호 재설정 버튼 문구를 표시한다", () => {
    render(
      <AuthEmailForm
        action={action}
        initialState={initialState}
        email={undefined}
        purpose="reset-password"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "비밀번호 재설정 인증 번호 받기",
      }),
    ).toBeInTheDocument();
  });

  it("email prop이 있으면 input 기본값으로 표시한다", () => {
    render(
      <AuthEmailForm
        action={action}
        initialState={initialState}
        email="test@example.com"
        purpose="signup"
      />,
    );

    expect(screen.getByLabelText("이메일")).toHaveValue("test@example.com");
  });

  it("email prop이 없으면 input은 빈 값으로 표시된다", () => {
    render(
      <AuthEmailForm
        action={action}
        initialState={initialState}
        email={undefined}
        purpose="signup"
      />,
    );

    expect(screen.getByLabelText("이메일")).toHaveValue("");
  });

  it("유효한 이메일 제출 시 FormData에 purpose와 email만 담아 formAction을 호출한다", async () => {
    const user = userEvent.setup();

    render(
      <AuthEmailForm
        action={action}
        initialState={initialState}
        email={undefined}
        purpose="signup"
      />,
    );

    await user.type(screen.getByLabelText("이메일"), "test@example.com");
    await user.click(
      screen.getByRole("button", { name: "인증 번호 다시 받기" }),
    );

    await waitFor(() => {
      expect(mockFormAction).toHaveBeenCalledTimes(1);
    });

    const formData = mockFormAction.mock.calls[0]?.[0] as FormData;

    expect(formData.get("purpose")).toBe("signup");
    expect(formData.get("email")).toBe("test@example.com");
    expect(formData.has("redirect")).toBe(false);
  });

  it("유효하지 않은 이메일이면 formAction을 호출하지 않는다", async () => {
    const user = userEvent.setup();

    render(
      <AuthEmailForm
        action={action}
        initialState={initialState}
        email={undefined}
        purpose="signup"
      />,
    );

    await user.type(screen.getByLabelText("이메일"), "invalid-email");
    await user.click(
      screen.getByRole("button", { name: "인증 번호 다시 받기" }),
    );

    await waitFor(() => {
      expect(mockFormAction).not.toHaveBeenCalled();
    });
  });

  it("pending 상태이면 버튼을 비활성화하고 전송 중 문구를 표시한다", () => {
    mockUseActionState.mockReturnValue([initialState, mockFormAction, true]);

    render(
      <AuthEmailForm
        action={action}
        initialState={initialState}
        email={undefined}
        purpose="signup"
      />,
    );

    expect(screen.getByRole("button", { name: "전송 중..." })).toBeDisabled();
  });
});
