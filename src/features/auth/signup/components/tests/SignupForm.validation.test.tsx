import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
} from "@/lib/constants/profiles";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants/user";

import { renderSignupForm } from "./utils/signupFormTestUtils";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

// SignupForm 클라이언트 유효성 검사 테스트
// - RHF + schema 기반의 필드 검증 동작을 검증한다.
// - blur, change, submit 시점별 에러 노출과 메시지 정확성을 확인한다.
// - confirmPassword 제외 제출 shape, 동의 항목 에러 위치, 한국어 메시지 회귀까지 포함한다.

// TC-01 ~ TC-15: 폼 레벨 유효성 검사
describe("회원가입 폼 검증", () => {
  it("TC-01: 초기 렌더 시 에러 메시지가 없다", () => {
    renderSignupForm();

    expect(
      screen.queryByText("올바른 이메일을 입력해주세요"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("비밀번호가 일치하지 않습니다"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(`닉네임은 ${NICKNAME_MIN_LENGTH}자 이상이어야 합니다`),
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
      await screen.findByText(
        `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상이어야 합니다`,
      ),
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
      screen.getByText(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`닉네임은 ${NICKNAME_MIN_LENGTH}자 이상이어야 합니다`),
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

  it(`TC-05: 비밀번호 ${PASSWORD_MIN_LENGTH}자 미만 입력 blur 시 에러가 표시된다`, async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.type(screen.getByLabelText(/^비밀번호$/i), "short1");
    await user.tab();

    expect(
      await screen.findByText(
        `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`,
      ),
    ).toBeInTheDocument();
  });

  it("TC-06: 공백만 입력된 닉네임 blur 시 에러가 표시된다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.type(screen.getByLabelText(/닉네임/i), "   ");
    await user.tab();

    expect(
      await screen.findByText(
        `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상이어야 합니다`,
      ),
    ).toBeInTheDocument();
  });

  it(`TC-07: 닉네임 ${NICKNAME_MAX_LENGTH}자 초과 입력 blur 시 에러가 표시된다`, async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.type(screen.getByLabelText(/닉네임/i), "가나다라마바사아자차카");
    await user.tab();

    expect(
      await screen.findByText(
        `닉네임은 ${NICKNAME_MAX_LENGTH}자 이내로 입력해주세요`,
      ),
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

  // 이 테스트는 validation 트리거 시점이 서로 다르기 때문에
  // blur / change / submit 흐름을 한 번에 확인하는 회귀용 테스트다.
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
      await screen.findByText(
        `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`,
      ),
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
      await screen.findByText(
        `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상이어야 합니다`,
      ),
    ).toBeInTheDocument();

    // 닉네임: 10자 초과
    await user.clear(screen.getByLabelText(/닉네임/i));
    await user.type(screen.getByLabelText(/닉네임/i), "가나다라마바사아자차카");
    await user.tab();
    expect(
      await screen.findByText(
        `닉네임은 ${NICKNAME_MAX_LENGTH}자 이내로 입력해주세요`,
      ),
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
