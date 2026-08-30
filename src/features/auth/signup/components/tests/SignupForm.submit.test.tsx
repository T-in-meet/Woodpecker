import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderSignupForm } from "./utils/signupFormTestUtils";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

// SignupForm 제출 및 pending 상태 테스트
// - 제출 가능/불가 조건과 onSubmit 호출 여부를 검증한다.
// - isPending이 true일 때 버튼 비활성화와 로딩 표시가 유지되는지 확인한다.
// - 제출 로직 자체의 최소 계약만 다루며, 상세 validation/에러 매핑은 별도 파일에서 검증한다.

// TC-01 ~ TC-05: 제출 동작 및 pending UI
describe("회원가입 폼 제출 및 pending 상태", () => {
  it("TC-01: 유효한 폼 제출 시 onSubmit이 정확히 1회 호출된다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignupForm({ onSubmit });

    await user.click(screen.getByRole("button", { name: /이메일로 가입/i }));

    fireEvent.change(screen.getByLabelText(/이메일/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^비밀번호$/i), {
      target: { value: "12345678" },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인/i), {
      target: { value: "12345678" },
    });
    fireEvent.change(screen.getByLabelText(/닉네임/i), {
      target: { value: "tester" },
    });
    // 이유: interactionEnabled=false 상태에서 체크박스 직접 클릭이 차단되므로 모달 경유
    await user.click(screen.getByRole("button", { name: /이용약관 보기/i }));
    await user.click(screen.getByRole("button", { name: /동의하기/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: /개인정보처리방침 보기/i }),
    );
    await user.click(screen.getByRole("button", { name: /동의하기/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await user.click(screen.getByTestId("age-14-checkbox"));

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it("TC-02: 유효하지 않은 폼 제출 시 onSubmit이 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignupForm({ onSubmit });

    await user.click(screen.getByRole("button", { name: /이메일로 가입/i }));

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it("TC-03: isPending이 true이면 제출 버튼이 비활성화된다", () => {
    renderSignupForm({ isPending: true });
    fireEvent.click(screen.getByRole("button", { name: /이메일로 가입/i }));

    expect(screen.getByRole("button", { name: /가입 중/i })).toBeDisabled();
  });

  it("TC-04: isPending이 true이면 제출 영역에 로딩 인디케이터가 표시된다", () => {
    renderSignupForm({ isPending: true });
    fireEvent.click(screen.getByRole("button", { name: /이메일로 가입/i }));
  });

  it("TC-05: isPending이 true인 상태에서 제출 버튼을 여러 번 클릭해도 onSubmit이 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignupForm({ onSubmit, isPending: true });

    await user.click(screen.getByRole("button", { name: /이메일로 가입/i }));

    const submitButton = screen.getByRole("button", { name: /가입 중/i });
    await user.click(submitButton);
    await user.click(submitButton);
    await user.click(submitButton);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(submitButton).toBeDisabled();
  });
});
