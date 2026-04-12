import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { RATE_LIMIT_TOAST_MESSAGE } from "@/features/auth/errors/rateLimitError";
import { UNKNOWN_ERROR_MESSAGE } from "@/features/auth/errors/unknownError";
import { showToast } from "@/lib/utils/showToast";

import VerifyEmailPageClient from "./VerifyEmailPageClient";

const { mockMutateAsync, mockHookState } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockHookState: { isPending: false },
}));

vi.mock(
  "@/features/auth/resend-verification-email/hooks/useResendVerificationEmailMutation",
  () => ({
    useResendVerificationEmailMutation: vi.fn(() => ({
      mutateAsync: mockMutateAsync,
      isPending: mockHookState.isPending,
    })),
  }),
);

vi.mock("@/lib/utils/showToast", () => ({
  showToast: vi.fn(),
}));

describe("VerifyEmailPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookState.isPending = false;
    mockMutateAsync.mockResolvedValue({
      success: true,
      code: AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS,
      data: { email: "test@example.com", resent: true },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("TC-01. 안내 메시지가 렌더링된다", () => {
    render(<VerifyEmailPageClient />);

    expect(screen.getByText(/회원가입이 완료되었습니다/)).toBeInTheDocument();
    expect(screen.getByText(/인증 이메일을 확인해주세요/)).toBeInTheDocument();
  });

  it("TC-02. 이메일 input과 재발송 버튼이 렌더링된다", () => {
    render(<VerifyEmailPageClient />);

    expect(
      screen.getByRole("textbox", { name: /이메일/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /인증 메일 재발송/i }),
    ).toBeInTheDocument();
  });

  it("TC-03. email prop이 있으면 input에 pre-fill된다", () => {
    render(<VerifyEmailPageClient email="prefill@example.com" />);

    expect(screen.getByRole("textbox", { name: /이메일/i })).toHaveValue(
      "prefill@example.com",
    );
  });

  it("TC-04. email prop이 없으면 input이 비어있다", () => {
    render(<VerifyEmailPageClient />);

    expect(screen.getByRole("textbox", { name: /이메일/i })).toHaveValue("");
  });

  it("TC-12. email prop에 공백이 포함되면 trim된 값으로 pre-fill된다", () => {
    render(<VerifyEmailPageClient email="  prefill@example.com  " />);

    expect(screen.getByRole("textbox", { name: /이메일/i })).toHaveValue(
      "prefill@example.com",
    );
  });

  it("TC-05. 이메일 입력 후 버튼 클릭 시 mutateAsync가 올바른 email로 호출된다", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailPageClient />);

    await user.type(
      screen.getByRole("textbox", { name: /이메일/i }),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: "test@example.com",
      });
    });
  });

  it("TC-06. isPending이면 버튼이 비활성화된다", () => {
    mockHookState.isPending = true;
    render(<VerifyEmailPageClient email="test@example.com" />);

    expect(
      screen.getByRole("button", { name: /인증 메일 재발송/i }),
    ).toBeDisabled();
  });

  it("TC-07. 성공 응답 시 성공 토스트가 표시된다", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("인증 메일이 재발송되었습니다.");
    });
  });

  it("TC-08. 성공 응답 시 파괴적 토스트는 표시되지 않는다", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("인증 메일이 재발송되었습니다.");
    });
    expect(showToast).not.toHaveBeenCalledWith(
      RATE_LIMIT_TOAST_MESSAGE,
      "destructive",
    );
  });

  it("TC-09. rate-limit code 에러면 generic rate-limit 토스트를 표시한다", async () => {
    mockMutateAsync.mockRejectedValueOnce({
      code: AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED,
    });
    const user = userEvent.setup();
    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        RATE_LIMIT_TOAST_MESSAGE,
        "destructive",
      );
    });
  });

  it("TC-10. 비 rate-limit 도메인 에러는 unknown 토스트로 처리된다", async () => {
    mockMutateAsync.mockRejectedValueOnce({
      code: AUTH_API_CODES.RESEND_INVALID_INPUT,
    });
    const user = userEvent.setup();
    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        UNKNOWN_ERROR_MESSAGE,
        "destructive",
      );
    });
    expect(showToast).not.toHaveBeenCalledWith(
      RATE_LIMIT_TOAST_MESSAGE,
      "destructive",
    );
  });

  it("TC-11. global error는 매핑된 메시지로 토스트를 표시한다", async () => {
    mockMutateAsync.mockRejectedValueOnce({ type: "server" });
    const user = userEvent.setup();
    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "잠시 후 다시 시도해주세요",
        "destructive",
      );
    });
  });
});
