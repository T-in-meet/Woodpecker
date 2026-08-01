import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { vi } from "vitest";

import { SignupForm } from "@/features/auth/signup/components/SignupForm";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

type InitialSignupMethod = "email" | "google" | null;

type RenderSignupFormOptions = Partial<ComponentProps<typeof SignupForm>> & {
  initialSignupMethod?: InitialSignupMethod;
};

/**
 * SignupForm을 기본 props와 함께 렌더링하는 테스트 헬퍼
 */
export function renderSignupForm({
  onSubmit = vi.fn(),
  isPending = false,
  initialSignupMethod = "email",
}: RenderSignupFormOptions = {}) {
  const result = render(
    <SignupForm onSubmit={onSubmit} isPending={isPending} />,
  );

  if (initialSignupMethod === "email") {
    fireEvent.click(screen.getByRole("button", { name: /이메일로 가입/i }));
  }

  if (initialSignupMethod === "google") {
    fireEvent.click(screen.getByRole("button", { name: /Google로 가입/i }));
  }

  return {
    onSubmit,
    ...result,
  };
}
