import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SignupPage from "@/app/(auth)/signup/page";

import { SignupForm } from "./SignupForm";

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

// TC-03 ~ TC-13: Form-level structure
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
