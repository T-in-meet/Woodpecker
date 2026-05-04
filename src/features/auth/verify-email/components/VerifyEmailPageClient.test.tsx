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

    // 행동 유도형 문구로 교체됨 — 사용자가 즉시 다음 행동을 인식할 수 있도록
    expect(
      screen.getByText(/가입하신 이메일로 인증 링크를 보냈습니다\./),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/메일이 오지 않으면 스팸함을 확인해주세요\./),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /여전히 보이지 않으면 위 버튼으로 다시 보낼 수 있습니다\./,
      ),
    ).toBeInTheDocument();
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

  it("TC-13. email prop이 있으면 이메일 주소가 안내 문구에 표시된다", () => {
    render(<VerifyEmailPageClient email="user@example.com" />);

    // 이메일 주소를 안내 문구에 직접 표시 — input에만 의존하지 않고 바로 인지 가능하도록
    expect(screen.getByDisplayValue("user@example.com")).toBeInTheDocument();
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

  it("TC-06. isPending이면 버튼이 비활성화되고 '전송 중...' 텍스트로 변경된다", () => {
    mockHookState.isPending = true;
    render(<VerifyEmailPageClient email="test@example.com" />);

    // 로딩 중 버튼 텍스트 변경 — SignupForm 패턴과 일관성 유지
    const button = screen.getByRole("button", { name: /전송 중/i });
    expect(button).toBeDisabled();
  });

  it("TC-07. 성공 응답 시 성공 토스트가 표시된다", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      // 행동 유도형 문구로 교체됨 — 상태 보고 대신 다음 행동 안내
      expect(showToast).toHaveBeenCalledWith(
        "메일을 다시 보냈습니다. 받은 편지함을 확인해주세요.",
      );
    });
  });

  it("TC-08. 성공 응답 시 파괴적 토스트는 표시되지 않는다", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      // 행동 유도형 문구로 교체됨 — 상태 보고 대신 다음 행동 안내
      expect(showToast).toHaveBeenCalledWith(
        "메일을 다시 보냈습니다. 받은 편지함을 확인해주세요.",
      );
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
      expect(showToast).toHaveBeenCalledWith(RATE_LIMIT_TOAST_MESSAGE, {
        variant: "destructive",
        dedupeKey: "auth-rate-limit",
      });
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
      expect(showToast).toHaveBeenCalledWith(UNKNOWN_ERROR_MESSAGE, {
        variant: "destructive",
        dedupeKey: "auth-unknown-error",
      });
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
      expect(showToast).toHaveBeenCalledWith("잠시 후 다시 시도해주세요", {
        variant: "destructive",
        dedupeKey: "auth-global-server",
      });
    });
  });

  it("TC-14. invalid email을 blur하면 이메일 형식 에러 메시지를 표시한다", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailPageClient />);

    const input = screen.getByRole("textbox", { name: /이메일/i });

    await user.type(input, "invalid-email");
    await user.tab();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "올바른 이메일을 입력해주세요",
    );
  });

  it("TC-15. invalid email submit이면 mutateAsync를 호출하지 않는다", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailPageClient />);

    await user.type(
      screen.getByRole("textbox", { name: /이메일/i }),
      "invalid",
    );
    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "올바른 이메일을 입력해주세요",
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("TC-17. 공백만 입력하면 required 에러 메시지를 표시하고 mutateAsync를 호출하지 않는다", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailPageClient />);

    await user.type(screen.getByRole("textbox", { name: /이메일/i }), "   ");
    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "이메일을 입력해주세요",
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("TC-18. 앞뒤 공백이 포함된 valid email submit이면 trim된 email로 mutateAsync를 호출한다", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailPageClient />);

    await user.type(
      screen.getByRole("textbox", { name: /이메일/i }),
      "  test@example.com  ",
    );
    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: "test@example.com",
      });
    });
  });

  it("TC-16. invalid email 에러가 표시된 뒤 valid email로 수정하면 에러 메시지가 사라지고 제출된다", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailPageClient />);

    const input = screen.getByRole("textbox", { name: /이메일/i });

    await user.type(input, "invalid");
    await user.tab();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "올바른 이메일을 입력해주세요",
    );

    await user.clear(input);
    await user.type(input, "test@example.com");

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: "test@example.com",
      });
    });
  });
});
