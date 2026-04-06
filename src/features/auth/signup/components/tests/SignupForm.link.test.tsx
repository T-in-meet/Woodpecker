import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderSignupForm } from "./utils/signupFormTestUtils";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

// SignupForm 링크 전용 테스트
// - 회원가입 폼 하단의 로그인 안내 문구와 링크 연결만 검증한다.
// - 구조/검증/제출/에러 처리와 분리하여, 링크 관련 회귀만 빠르게 확인하기 위한 파일이다.

// TC-01 ~ TC-02: 로그인 링크 렌더링 및 이동 경로
describe("회원가입 로그인 링크", () => {
  it("TC-01: 회원가입 폼에 로그인 안내 텍스트가 렌더링된다", () => {
    renderSignupForm();

    expect(screen.getByText("이미 가입하셨나요?")).toBeInTheDocument();
  });

  it("TC-02: 로그인 안내 요소가 /login을 가리키는 링크로 접근 가능하다", () => {
    renderSignupForm();

    const loginLink = screen.getByRole("link", { name: "이미 가입하셨나요?" });

    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });
});
