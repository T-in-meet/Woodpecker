import { render } from "@testing-library/react";
import { vi } from "vitest";

import type { SignupFormProps } from "@/features/auth/signup/components/SignupForm";
import { SignupForm } from "@/features/auth/signup/components/SignupForm";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

type InitialSignupMethod = "email" | "google" | null;

type RenderSignupFormOptions = Omit<
  Partial<SignupFormProps>,
  "initialSignupMethod"
> & {
  initialSignupMethod?: InitialSignupMethod;
};

/**
 * SignupForm을 기본 props와 함께 렌더링하는 테스트 헬퍼
 */
export function renderSignupForm({
  onSubmit = vi.fn(),
  isPending = false,
  initialSignupMethod = "email",
  ...signupFormProps
}: RenderSignupFormOptions = {}) {
  const result = render(
    <SignupForm
      onSubmit={onSubmit}
      isPending={isPending}
      {...(initialSignupMethod ? { initialSignupMethod } : {})}
      {...signupFormProps}
    />,
  );

  return {
    onSubmit,
    ...result,
  };
}
