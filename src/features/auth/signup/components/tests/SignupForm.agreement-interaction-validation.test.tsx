import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderSignupForm } from "./utils/signupFormTestUtils";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

// SignupForm 동의 상호작용 + Validation 테스트
// - interactionEnabled 상태가 validation과 어떻게 상호작용하는지 검증
// - 모달 미열람 vs 열람 상태에서의 validation 차이 확인

describe("회원가입 폼 동의 상호작용 + Validation", () => {
  it("TC-01: 모달 미열람 상태에서 폼 제출 시 약관 에러가 표시된다", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSignupForm();

    // 필수 필드들을 채우되, 약관은 체크하지 않기
    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "Test@1234");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "Test@1234");
    await user.type(screen.getByLabelText(/닉네임/i), "testuser");

    // 약관 미체크 → 제출
    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    // 이용약관 에러 확인
    // 이유: 모달을 열지 않았으므로 체크박스가 체크되지 않음
    //       → validation 실패로 에러 표시
    await waitFor(() => {
      expect(screen.getByText("이용약관에 동의해주세요")).toBeInTheDocument();
    });

    // onSubmit은 호출되지 않아야 함 (validation 실패)
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("TC-02: 모달을 열고 닫기만 해도(미동의) 폼 제출 시 약관 에러가 표시된다", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSignupForm();

    // 필수 필드 채우기
    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "Test@1234");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "Test@1234");
    await user.type(screen.getByLabelText(/닉네임/i), "testuser");

    // 이용약관 모달을 열고 닫기만 하기 (동의 없이)
    // 이유: interactionEnabled=true가 되더라도 checked=false인 경우
    //       validation이 실패해야 함
    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");
    await user.click(termsCheckbox);
    await user.click(screen.getByRole("button", { name: /닫기/i }));

    // 이제 termsCheckbox는 체크되지 않은 상태
    // (모달을 열기만 했고 "동의하기"를 누르지 않음)
    await waitFor(() => {
      expect(termsCheckbox).not.toBeChecked();
    });

    // 폼 제출
    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    // 여전히 약관 에러 표시 (validation 실패)
    await waitFor(() => {
      expect(screen.getByText("이용약관에 동의해주세요")).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('TC-03: "동의하기" 후 폼 제출 시 약관 에러가 표시되지 않는다', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSignupForm();

    // 필수 필드 채우기
    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "Test@1234");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "Test@1234");
    await user.type(screen.getByLabelText(/닉네임/i), "testuser");

    // 이용약관 모달 열기 → "동의하기" 클릭
    // 이유: onAgree에서 setValue("termsOfService", true)를 호출하므로
    //       체크박스가 checked=true가 됨
    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");
    await user.click(termsCheckbox);
    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    // 개인정보도 동의하기
    const privacyCheckbox = screen.getByTestId("privacy-policy-checkbox");
    await user.click(privacyCheckbox);
    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    // 두 체크박스 모두 체크된 상태 확인
    await waitFor(() => {
      expect(termsCheckbox).toBeChecked();
      expect(privacyCheckbox).toBeChecked();
    });

    // 폼 제출
    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    // 약관 에러 없음 (validation 통과)
    // 이유: 두 동의 항목이 모두 checked=true 상태
    await waitFor(() => {
      expect(
        screen.queryByText("이용약관에 동의해주세요"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("개인정보 처리방침에 동의해주세요"),
      ).not.toBeInTheDocument();
    });

    // onSubmit이 호출되어야 함 (validation 통과)
    // 실제로는 API 호출이 이루어지므로 mock이 호출되는지 확인
    expect(onSubmit).toHaveBeenCalled();
  });

  it("TC-04: 동의 후 언체크하면 다시 약관 에러가 표시된다", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSignupForm();

    // 필수 필드 채우기
    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "Test@1234");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "Test@1234");
    await user.type(screen.getByLabelText(/닉네임/i), "testuser");

    // 이용약관 모달 열고 동의하기
    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");
    await user.click(termsCheckbox);
    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    // 체크 상태 확인
    await waitFor(() => {
      expect(termsCheckbox).toBeChecked();
    });

    // 다시 클릭해서 언체크하기
    // 이유: interactionEnabled=true 상태에서 직접 조작 가능
    await user.click(termsCheckbox);

    await waitFor(() => {
      expect(termsCheckbox).not.toBeChecked();
    });

    // 개인정보는 동의하기
    const privacyCheckbox = screen.getByTestId("privacy-policy-checkbox");
    await user.click(privacyCheckbox);
    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    // 폼 제출
    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    // 이용약관 에러 표시 (validation 실패)
    await waitFor(() => {
      expect(screen.getByText("이용약관에 동의해주세요")).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
