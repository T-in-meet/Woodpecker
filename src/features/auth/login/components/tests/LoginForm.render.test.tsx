/**
 * LoginForm 렌더링 테스트
 *
 * 검증 범위:
 * - 이메일 입력, 비밀번호 입력, 로그인 버튼이 존재하는지
 * - 비밀번호 찾기 링크가 /forgot-password로 연결되는지
 */

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { renderLoginForm, setupDefaultMocks } from "./utils/loginFormTestUtils";

describe("LoginForm 렌더링", () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  it("이메일 입력 필드가 존재한다", () => {
    renderLoginForm();
    expect(screen.getByLabelText(/이메일/i)).toBeInTheDocument();
  });

  it("비밀번호 입력 필드가 존재한다", () => {
    renderLoginForm();
    expect(screen.getByLabelText(/^비밀번호$/i)).toBeInTheDocument();
  });

  it("로그인 버튼이 존재한다", () => {
    renderLoginForm();
    expect(
      screen.getByRole("button", { name: /^로그인$/ }),
    ).toBeInTheDocument();
  });

  it("비밀번호 찾기 링크가 /forgot-password로 연결된다", () => {
    renderLoginForm();
    const link = screen.getByRole("link", { name: /비밀번호 찾기/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });
});
