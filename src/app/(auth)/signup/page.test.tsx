import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SignupPage from "@/app/(auth)/signup/page";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("@/features/auth/signup/hooks/useSignupMutation", () => ({
  useSignupMutation: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

describe("SignupPage", () => {
  it("회원가입 폼을 렌더링한다", () => {
    render(<SignupPage />);
    expect(screen.getByRole("form", { name: /회원가입/i })).toBeInTheDocument();
  });
});
