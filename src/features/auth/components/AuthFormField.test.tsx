import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthFormField } from "./AuthFormField";

describe("AuthFormField", () => {
  it("field error가 있으면 input과 error message를 aria-describedby로 연결한다", () => {
    render(
      <AuthFormField
        label="이메일"
        htmlFor="email"
        error="이메일을 입력해주세요."
      >
        <input id="email" />
      </AuthFormField>,
    );

    const input = screen.getByLabelText("이메일");
    const error = screen.getByRole("alert");

    expect(input).toHaveAttribute("aria-describedby", "email-error");
    expect(error).toHaveAttribute("id", "email-error");
    expect(error).toHaveTextContent("이메일을 입력해주세요.");
  });

  it("field error가 없으면 error용 aria-describedby를 추가하지 않는다", () => {
    render(
      <AuthFormField label="이메일" htmlFor="email">
        <input id="email" />
      </AuthFormField>,
    );

    expect(screen.getByLabelText("이메일")).not.toHaveAttribute(
      "aria-describedby",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("기존 aria-describedby가 있으면 field error id를 함께 유지한다", () => {
    render(
      <>
        <AuthFormField
          label="비밀번호"
          htmlFor="password"
          error="비밀번호를 입력해주세요."
        >
          <input id="password" aria-describedby="password-help" />
        </AuthFormField>

        <p id="password-help">8자 이상 입력하세요.</p>
      </>,
    );

    expect(screen.getByLabelText("비밀번호")).toHaveAttribute(
      "aria-describedby",
      "password-help password-error",
    );
    expect(screen.getByRole("alert")).toHaveAttribute("id", "password-error");
  });

  it("field error가 없어도 기존 aria-describedby는 유지한다", () => {
    render(
      <>
        <AuthFormField label="비밀번호" htmlFor="password">
          <input id="password" aria-describedby="password-help" />
        </AuthFormField>

        <p id="password-help">8자 이상 입력하세요.</p>
      </>,
    );

    expect(screen.getByLabelText("비밀번호")).toHaveAttribute(
      "aria-describedby",
      "password-help",
    );
  });
});
