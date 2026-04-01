import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { SignupForm } from "./SignupForm";

function renderSignupForm({
  onSubmit = vi.fn(),
  isPending = false,
}: Partial<ComponentProps<typeof SignupForm>> = {}) {
  return {
    onSubmit,
    ...render(<SignupForm onSubmit={onSubmit} isPending={isPending} />),
  };
}

// TC-03 ~ TC-13: Form-level structure (구조 테스트)
describe("회원가입 폼", () => {
  it("TC-03: 모든 필수 입력 필드를 렌더링한다", () => {
    renderSignupForm();

    expect(screen.getByLabelText(/이메일/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^비밀번호$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/비밀번호 확인/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/닉네임/i)).toBeInTheDocument();
  });

  it("TC-04: 필수 약관 동의 체크박스를 렌더링한다", () => {
    renderSignupForm();

    expect(
      screen.getByRole("checkbox", { name: /이용약관/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /개인정보/i }),
    ).toBeInTheDocument();
  });

  it("TC-05: 선택 입력인 프로필 이미지 파일 input을 렌더링한다", () => {
    renderSignupForm();

    expect(screen.getByLabelText(/프로필/i)).toBeInTheDocument();
  });

  it("TC-06: 이용약관 및 개인정보 처리방침 내용을 확인할 수 있는 트리거를 렌더링한다", () => {
    renderSignupForm();

    expect(
      screen.getByRole("button", { name: /이용약관 보기/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /개인정보처리방침 보기/i }),
    ).toBeInTheDocument();
  });

  it('TC-07: type="submit"인 회원가입 버튼을 렌더링한다', () => {
    renderSignupForm();

    const submitButton = screen.getByRole("button", { name: /회원가입/i });

    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute("type", "submit");
  });

  it("TC-08: 선택 필드(프로필 이미지)가 필수 필드와 구분되어 표시된다", () => {
    renderSignupForm();

    expect(screen.getByText(/선택/i)).toBeInTheDocument();
  });

  it("TC-09: 모든 입력과 체크박스가 접근 가능한 label과 연결되어 있다", () => {
    renderSignupForm();

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

  it('TC-10: 비밀번호 및 비밀번호 확인 필드는 type="password"를 사용한다', () => {
    renderSignupForm();

    expect(screen.getByLabelText(/^비밀번호$/i)).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText(/비밀번호 확인/i)).toHaveAttribute(
      "type",
      "password",
    );
  });

  it('TC-11: 이메일 필드는 type="email"을 사용한다', () => {
    renderSignupForm();

    expect(screen.getByLabelText(/이메일/i)).toHaveAttribute("type", "email");
  });

  it("TC-12: 초기 렌더링 시 약관 체크박스는 체크되지 않은 상태이다", () => {
    renderSignupForm();

    expect(
      screen.getByRole("checkbox", { name: /이용약관/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /개인정보/i }),
    ).not.toBeChecked();
  });

  it("TC-13: 초기 렌더링 시 회원가입 버튼은 활성 상태이다", () => {
    renderSignupForm();

    expect(
      screen.getByRole("button", { name: /회원가입/i }),
    ).not.toBeDisabled();
  });
});

// TC-14 ~ TC-15: Login Link (PR-UI-01A)
// 회원가입 폼 하단 로그인 이동 링크 추가
// PR-UI-01 완료 이후 보강 스펙으로 추가됨
describe("회원가입 로그인 링크", () => {
  it("TC-14: 회원가입 폼에 로그인 안내 텍스트가 렌더링된다", () => {
    renderSignupForm();

    expect(screen.getByText("이미 가입하셨나요?")).toBeInTheDocument();
  });

  it("TC-15: 로그인 안내 요소가 /login을 가리키는 링크로 접근 가능하다", () => {
    renderSignupForm();

    const loginLink = screen.getByRole("link", { name: "이미 가입하셨나요?" });

    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });
});

// TC-01 ~ TC-15: Form-level validation (유효성 검사 테스트)
describe("회원가입 폼 검증", () => {
  it("TC-01: 초기 렌더 시 에러 메시지가 없다", () => {
    renderSignupForm();

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
    renderSignupForm();

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
    renderSignupForm();

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

  it("TC-04: 유효하지 않은 폼 제출 시 onSubmit이 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignupForm({ onSubmit });

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it("TC-05: 비밀번호 8자 미만 입력 blur 시 에러가 표시된다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.type(screen.getByLabelText(/^비밀번호$/i), "short1");
    await user.tab();

    expect(
      await screen.findByText("비밀번호는 8자 이상이어야 합니다"),
    ).toBeInTheDocument();
  });

  it("TC-06: 공백만 입력된 닉네임 blur 시 에러가 표시된다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.type(screen.getByLabelText(/닉네임/i), "   ");
    await user.tab();

    expect(
      await screen.findByText("닉네임은 1자 이상이어야 합니다"),
    ).toBeInTheDocument();
  });

  it("TC-07: 닉네임 10자 초과 입력 blur 시 에러가 표시된다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.type(screen.getByLabelText(/닉네임/i), "가나다라마바사아자차카");
    await user.tab();

    expect(
      await screen.findByText("닉네임은 10자 이내로 입력해주세요"),
    ).toBeInTheDocument();
  });

  it("TC-08: 이용약관 미체크 제출 시 에러가 표시된다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

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
    renderSignupForm();

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
    renderSignupForm();

    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "different123");

    expect(
      await screen.findByText("비밀번호가 일치하지 않습니다"),
    ).toBeInTheDocument();
  });

  it("TC-11: 비밀번호 확인이 일치하면 에러가 표시되지 않는다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

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
    renderSignupForm();

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

  it("TC-13: 유효한 폼 제출 시 onSubmit이 1회 호출되며 confirmPassword가 포함되지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignupForm({ onSubmit });

    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");
    await user.type(screen.getByLabelText(/닉네임/i), "테스트닉");
    await user.click(screen.getByRole("checkbox", { name: /이용약관/i }));
    await user.click(screen.getByRole("checkbox", { name: /개인정보/i }));

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const calledWith = onSubmit.mock.calls[0]![0] as Record<string, unknown>;
    expect(calledWith).not.toHaveProperty("confirmPassword");
    expect(calledWith).not.toHaveProperty("passwordConfirm");
  });

  it("TC-14: 동의 항목 에러가 해당 체크박스 영역 내에 렌더링된다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");
    await user.type(screen.getByLabelText(/닉네임/i), "테스트닉");

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    const termsField = screen.getByTestId("terms-of-service-field");
    const privacyField = screen.getByTestId("privacy-policy-field");

    // 1️⃣ 영역 내부 검증
    expect(
      within(termsField).getByText("이용약관에 동의해주세요"),
    ).toBeInTheDocument();

    expect(
      within(privacyField).getByText("개인정보 처리방침에 동의해주세요"),
    ).toBeInTheDocument();

    // 2️⃣ 접근성 연결 검증
    const termsCheckbox = screen.getByRole("checkbox", { name: /이용약관/i });
    const privacyCheckbox = screen.getByRole("checkbox", { name: /개인정보/i });

    expect(termsCheckbox).toHaveAttribute(
      "aria-describedby",
      "terms-of-service-error",
    );

    expect(privacyCheckbox).toHaveAttribute(
      "aria-describedby",
      "privacy-policy-error",
    );
  });

  // 이 테스트는 필드별 validation 트리거가 서로 다르므로
  // (blur / change / submit) 각 단계의 상태 전이를 명시적으로 검증한다.
  it("TC-15: 각 필드의 정확한 Korean 에러 메시지를 표시한다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

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

// TC-01 ~ TC-05: Submit & Pending
describe("회원가입 폼 제출 및 pending 상태", () => {
  it("TC-01: 유효한 폼 제출 시 onSubmit이 정확히 1회 호출된다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignupForm({ onSubmit });

    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "12345678");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "12345678");
    await user.type(screen.getByLabelText(/닉네임/i), "tester");
    await user.click(screen.getByRole("checkbox", { name: /이용약관/i }));
    await user.click(screen.getByRole("checkbox", { name: /개인정보/i }));

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it("TC-02: 유효하지 않은 폼 제출 시 onSubmit이 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignupForm({ onSubmit });

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it("TC-03: isPending이 true이면 제출 버튼이 비활성화된다", () => {
    renderSignupForm({ isPending: true });

    expect(screen.getByRole("button", { name: /회원가입/i })).toBeDisabled();
  });

  it("TC-04: isPending이 true이면 제출 영역에 로딩 인디케이터가 표시된다", () => {
    renderSignupForm({ isPending: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("TC-05: isPending이 true인 상태에서 제출 버튼을 여러 번 클릭해도 onSubmit이 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignupForm({ onSubmit, isPending: true });

    const submitButton = screen.getByRole("button", { name: /회원가입/i });
    await user.click(submitButton);
    await user.click(submitButton);
    await user.click(submitButton);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(submitButton).toBeDisabled();
  });
});
