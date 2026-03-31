import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignupPage from "@/app/(auth)/signup/page";

import { SignupForm } from "./SignupForm";

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

// TC-01, TC-02: Page-level structure
describe("SignupPage", () => {
  it("TC-01: signup page renders the signup form", () => {
    render(<SignupPage />);

    expect(screen.getByRole("form")).toBeInTheDocument();
  });

  it("TC-02: maintains single-page structure without step indicator or navigation buttons", () => {
    render(<SignupPage />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /다음/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /이전/i }),
    ).not.toBeInTheDocument();
  });
});

// TC-03 ~ TC-13: Form-level structure (구조 테스트)
describe("SignupForm", () => {
  it("TC-03: renders all required text input fields", () => {
    render(<SignupForm />);

    expect(screen.getByLabelText(/이메일/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^비밀번호$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/비밀번호 확인/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/닉네임/i)).toBeInTheDocument();
  });

  it("TC-04: renders required agreement checkboxes", () => {
    render(<SignupForm />);

    expect(
      screen.getByRole("checkbox", { name: /이용약관/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /개인정보/i }),
    ).toBeInTheDocument();
  });

  it("TC-05: renders the optional avatar file input", () => {
    render(<SignupForm />);

    expect(screen.getByLabelText(/프로필/i)).toBeInTheDocument();
  });

  it("TC-06: renders triggers to view terms of service and privacy policy content", () => {
    render(<SignupForm />);

    expect(
      screen.getByRole("button", { name: /이용약관 보기/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /개인정보처리방침 보기/i }),
    ).toBeInTheDocument();
  });

  it("TC-07: renders the submit button with type submit", () => {
    render(<SignupForm />);

    const submitButton = screen.getByRole("button", { name: /회원가입/i });

    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute("type", "submit");
  });

  it("TC-08: visually distinguishes the optional avatar field from required fields", () => {
    render(<SignupForm />);

    expect(screen.getByText(/선택/i)).toBeInTheDocument();
  });

  it("TC-09: associates all inputs and checkboxes with accessible labels", () => {
    render(<SignupForm />);

    expect(screen.getByLabelText(/이메일/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^비밀번호$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/비밀번호 확인/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/닉네임/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/프로필/i)).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /이용약관/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /개인정보/i }),
    ).toBeInTheDocument();
  });

  it("TC-10: uses type password for both password fields", () => {
    render(<SignupForm />);

    expect(screen.getByLabelText(/^비밀번호$/i)).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText(/비밀번호 확인/i)).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("TC-11: uses type email for the email field", () => {
    render(<SignupForm />);

    expect(screen.getByLabelText(/이메일/i)).toHaveAttribute("type", "email");
  });

  it("TC-12: renders agreement checkboxes unchecked on initial render", () => {
    render(<SignupForm />);

    expect(
      screen.getByRole("checkbox", { name: /이용약관/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /개인정보/i }),
    ).not.toBeChecked();
  });

  it("TC-13: renders the submit button enabled on initial render", () => {
    render(<SignupForm />);

    expect(
      screen.getByRole("button", { name: /회원가입/i }),
    ).not.toBeDisabled();
  });
});

// TC-01 ~ TC-15: Form-level validation (유효성 검사 테스트)
describe("SignupForm Validation", () => {
  let mockMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockMutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as UseMutationResult<unknown, Error, unknown, unknown>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("TC-01: 초기 렌더 시 에러 메시지가 없다", () => {
    render(<SignupForm />);

    expect(
      screen.queryByText("올바른 이메일을 입력해주세요"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("비밀번호는 8자 이상이어야 합니다"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("비밀번호가 일치하지 않습니다"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("닉네임은 1자 이상이어야 합니다"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("이용약관에 동의해주세요"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("개인정보 처리방침에 동의해주세요"),
    ).not.toBeInTheDocument();
  });

  it("TC-02: 이메일/닉네임 필드 blur 시 에러가 표시된다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/이메일/i), "invalid-email");
    await user.tab();

    expect(
      await screen.findByText("올바른 이메일을 입력해주세요"),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText(/닉네임/i));
    await user.tab();

    expect(
      await screen.findByText("닉네임은 1자 이상이어야 합니다"),
    ).toBeInTheDocument();
  });

  it("TC-03: 빈 폼 제출 시 전체 유효성 검사 에러가 표시된다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    expect(
      await screen.findByText("올바른 이메일을 입력해주세요"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("비밀번호는 8자 이상이어야 합니다"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("닉네임은 1자 이상이어야 합니다"),
    ).toBeInTheDocument();
    expect(screen.getByText("이용약관에 동의해주세요")).toBeInTheDocument();
    expect(
      screen.getByText("개인정보 처리방침에 동의해주세요"),
    ).toBeInTheDocument();
  });

  it("TC-04: 유효하지 않은 폼 제출 시 mutate가 호출되지 않는다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  it("TC-05: 비밀번호 8자 미만 입력 blur 시 에러가 표시된다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/^비밀번호$/i), "short1");
    await user.tab();

    expect(
      await screen.findByText("비밀번호는 8자 이상이어야 합니다"),
    ).toBeInTheDocument();
  });

  it("TC-06: 공백만 입력된 닉네임 blur 시 에러가 표시된다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/닉네임/i), "   ");
    await user.tab();

    expect(
      await screen.findByText("닉네임은 1자 이상이어야 합니다"),
    ).toBeInTheDocument();
  });

  it("TC-07: 닉네임 10자 초과 입력 blur 시 에러가 표시된다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/닉네임/i), "가나다라마바사아자차카");
    await user.tab();

    expect(
      await screen.findByText("닉네임은 10자 이내로 입력해주세요"),
    ).toBeInTheDocument();
  });

  it("TC-08: 이용약관 미체크 제출 시 에러가 표시된다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");
    await user.type(screen.getByLabelText(/닉네임/i), "테스트닉");
    await user.click(screen.getByRole("checkbox", { name: /개인정보/i }));

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    expect(
      await screen.findByText("이용약관에 동의해주세요"),
    ).toBeInTheDocument();
  });

  it("TC-09: 개인정보 처리방침 미체크 제출 시 에러가 표시된다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");
    await user.type(screen.getByLabelText(/닉네임/i), "테스트닉");
    await user.click(screen.getByRole("checkbox", { name: /이용약관/i }));

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    expect(
      await screen.findByText("개인정보 처리방침에 동의해주세요"),
    ).toBeInTheDocument();
  });

  it("TC-10: 비밀번호 확인 입력 중 불일치 시 에러가 실시간으로 표시된다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "different123");

    expect(
      await screen.findByText("비밀번호가 일치하지 않습니다"),
    ).toBeInTheDocument();
  });

  it("TC-11: 비밀번호 확인이 일치하면 에러가 표시되지 않는다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");

    await waitFor(() => {
      expect(
        screen.queryByText("비밀번호가 일치하지 않습니다"),
      ).not.toBeInTheDocument();
    });
  });

  it("TC-12: 일치하던 비밀번호 확인 후 비밀번호 변경 시 에러가 다시 표시된다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");

    await waitFor(() => {
      expect(
        screen.queryByText("비밀번호가 일치하지 않습니다"),
      ).not.toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText(/^비밀번호$/i));
    await user.type(screen.getByLabelText(/^비밀번호$/i), "different456");

    expect(
      await screen.findByText("비밀번호가 일치하지 않습니다"),
    ).toBeInTheDocument();
  });

  it("TC-13: 유효한 폼 제출 시 mutate가 1회 호출되며 confirmPassword가 포함되지 않는다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");
    await user.type(screen.getByLabelText(/닉네임/i), "테스트닉");
    await user.click(screen.getByRole("checkbox", { name: /이용약관/i }));
    await user.click(screen.getByRole("checkbox", { name: /개인정보/i }));

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    const calledWith = mockMutate.mock.calls[0]![0] as Record<string, unknown>;
    expect(calledWith).not.toHaveProperty("confirmPassword");
    expect(calledWith).not.toHaveProperty("passwordConfirm");
  });

  it("TC-14: 동의 항목 에러가 해당 체크박스 영역 내에 렌더링된다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");
    await user.type(screen.getByLabelText(/닉네임/i), "테스트닉");

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await screen.findByText("이용약관에 동의해주세요");

    const termsCheckbox = screen.getByRole("checkbox", { name: /이용약관/i });
    const privacyCheckbox = screen.getByRole("checkbox", { name: /개인정보/i });

    expect(
      within(termsCheckbox.closest("div")!).getByText(
        "이용약관에 동의해주세요",
      ),
    ).toBeInTheDocument();

    expect(
      within(privacyCheckbox.closest("div")!).getByText(
        "개인정보 처리방침에 동의해주세요",
      ),
    ).toBeInTheDocument();
  });

  it("TC-15: 각 필드의 정확한 Korean 에러 메시지를 표시한다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    // 이메일: 잘못된 형식
    await user.type(screen.getByLabelText(/이메일/i), "not-an-email");
    await user.tab();
    expect(
      await screen.findByText("올바른 이메일을 입력해주세요"),
    ).toBeInTheDocument();

    // 비밀번호: 8자 미만
    await user.type(screen.getByLabelText(/^비밀번호$/i), "short1");
    await user.tab();
    expect(
      await screen.findByText("비밀번호는 8자 이상이어야 합니다"),
    ).toBeInTheDocument();

    // 비밀번호 확인: 불일치
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "different");
    expect(
      await screen.findByText("비밀번호가 일치하지 않습니다"),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^비밀번호$/i));
    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.clear(screen.getByLabelText(/비밀번호 확인/i));
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");
    await waitFor(() => {
      expect(
        screen.queryByText("비밀번호가 일치하지 않습니다"),
      ).not.toBeInTheDocument();
    });

    // 닉네임: 공백만 입력 (trim 후 1자 미만)
    await user.type(screen.getByLabelText(/닉네임/i), "   ");
    await user.tab();
    expect(
      await screen.findByText("닉네임은 1자 이상이어야 합니다"),
    ).toBeInTheDocument();

    // 닉네임: 10자 초과
    await user.clear(screen.getByLabelText(/닉네임/i));
    await user.type(screen.getByLabelText(/닉네임/i), "가나다라마바사아자차카");
    await user.tab();
    expect(
      await screen.findByText("닉네임은 10자 이내로 입력해주세요"),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/이메일/i));
    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.clear(screen.getByLabelText(/닉네임/i));
    await user.type(screen.getByLabelText(/닉네임/i), "테스트닉");

    // 동의 항목: 미체크 상태에서 제출
    await user.click(screen.getByRole("button", { name: /회원가입/i }));
    expect(screen.getByText("이용약관에 동의해주세요")).toBeInTheDocument();
    expect(
      screen.getByText("개인정보 처리방침에 동의해주세요"),
    ).toBeInTheDocument();
  });
});

// TC-01 ~ TC-05: Submit & Mutation (PR-UI-04)
describe("SignupForm Submit & Mutation", () => {
  let mockMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockMutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as UseMutationResult<unknown, Error, unknown, unknown>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("TC-01: 유효한 폼 제출 시 mutate가 정확히 1회 호출된다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "12345678");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "12345678");
    await user.type(screen.getByLabelText(/닉네임/i), "tester");
    await user.click(screen.getByRole("checkbox", { name: /이용약관/i }));
    await user.click(screen.getByRole("checkbox", { name: /개인정보/i }));

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
  });

  it("TC-02: 유효하지 않은 폼 제출 시 mutate가 호출되지 않는다", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  it("TC-03: isPending이 true이면 제출 버튼이 비활성화된다", () => {
    vi.mocked(useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    } as unknown as UseMutationResult<unknown, Error, unknown, unknown>);

    render(<SignupForm />);

    expect(screen.getByRole("button", { name: /회원가입/i })).toBeDisabled();
  });

  it("TC-04: isPending이 true이면 제출 영역에 로딩 인디케이터가 표시된다", () => {
    vi.mocked(useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    } as unknown as UseMutationResult<unknown, Error, unknown, unknown>);

    render(<SignupForm />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("TC-05: isPending이 true인 상태에서 제출 버튼을 여러 번 클릭해도 mutate가 호출되지 않는다", async () => {
    vi.mocked(useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    } as unknown as UseMutationResult<unknown, Error, unknown, unknown>);

    const user = userEvent.setup();
    render(<SignupForm />);

    const submitButton = screen.getByRole("button", { name: /회원가입/i });
    await user.click(submitButton);
    await user.click(submitButton);
    await user.click(submitButton);

    expect(mockMutate).not.toHaveBeenCalled();
    expect(submitButton).toBeDisabled();
  });
});
