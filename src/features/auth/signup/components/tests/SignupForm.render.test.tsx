import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderSignupForm } from "./utils/signupFormTestUtils";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

// SignupForm 구조 렌더링 테스트
// - 폼의 정적 구조와 기본 접근성 연결을 검증한다.
// - 필수/선택 입력, 체크박스, 버튼, label 연결, input type, 초기 상태를 확인한다.
// - 사용자 상호작용 중심 검증이나 서버 에러 검증은 다른 테스트 파일에서 다룬다.

// 기본 구조 렌더링 테스트
// - 사용자가 처음 폼을 봤을 때 필요한 요소가 모두 존재하는지 검증
// - 접근 가능한 label 연결과 초기 상태까지 포함

// TC-01 ~ TC-11: 기본 구조 및 접근성 렌더링
describe("회원가입 폼", () => {
  it("TC-01: 모든 필수 입력 필드를 렌더링한다", () => {
    renderSignupForm();

    expect(screen.getByLabelText(/이메일/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^비밀번호$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/비밀번호 확인/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/닉네임/i)).toBeInTheDocument();
  });

  it("TC-02: 필수 약관 동의 체크박스를 렌더링한다", () => {
    renderSignupForm();

    expect(
      screen.getByRole("checkbox", { name: /이용약관/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /개인정보/i }),
    ).toBeInTheDocument();
  });

  it("TC-03: 선택 입력인 프로필 이미지 파일 input을 렌더링한다", () => {
    renderSignupForm();

    expect(screen.getByLabelText(/프로필/i)).toBeInTheDocument();
  });

  it("TC-04: 이용약관 및 개인정보 처리방침 내용을 확인할 수 있는 트리거를 렌더링한다", () => {
    renderSignupForm();

    expect(
      screen.getByRole("button", { name: /이용약관 보기/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /개인정보처리방침 보기/i }),
    ).toBeInTheDocument();
  });

  it('TC-05: type="submit"인 회원가입 버튼을 렌더링한다', () => {
    renderSignupForm();

    const submitButton = screen.getByRole("button", { name: /회원가입/i });

    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute("type", "submit");
  });

  it("TC-06: 선택 필드(프로필 이미지)가 필수 필드와 구분되어 표시된다", () => {
    renderSignupForm();

    expect(screen.getByText(/선택/i)).toBeInTheDocument();
  });

  it("TC-07: 모든 입력과 체크박스가 접근 가능한 label과 연결되어 있다", () => {
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

  it('TC-08: 비밀번호 및 비밀번호 확인 필드는 type="password"를 사용한다', () => {
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

  it('TC-09: 이메일 필드는 type="email"을 사용한다', () => {
    renderSignupForm();

    expect(screen.getByLabelText(/이메일/i)).toHaveAttribute("type", "email");
  });

  it("TC-10: 초기 렌더링 시 약관 체크박스는 체크되지 않은 상태이다", () => {
    renderSignupForm();

    expect(
      screen.getByRole("checkbox", { name: /이용약관/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /개인정보/i }),
    ).not.toBeChecked();
  });

  it("TC-11: 초기 렌더링 시 회원가입 버튼은 활성 상태이다", () => {
    renderSignupForm();

    expect(
      screen.getByRole("button", { name: /회원가입/i }),
    ).not.toBeDisabled();
  });
});
