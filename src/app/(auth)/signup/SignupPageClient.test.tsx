import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignupPageClient from "@/app/(auth)/signup/SignupPageClient";

const mockPush = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

vi.mock("@/features/auth/hooks/useSignupMutation", () => ({
  useSignupMutation: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

async function submitValidSignupForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
  await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
  await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");
  await user.type(screen.getByLabelText(/닉네임/i), "tester");
  await user.click(screen.getByRole("checkbox", { name: /이용약관/i }));
  await user.click(screen.getByRole("checkbox", { name: /개인정보/i }));
  await user.click(screen.getByRole("button", { name: /회원가입/i }));
}

describe("PR-UI-05: SignupPageClient redirectTo 라우팅", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockMutateAsync.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("TC-02: mutateAsync가 redirectTo='/login'으로 응답하면 router.push('/login')가 1회 호출된다", async () => {
    mockMutateAsync.mockResolvedValue({ data: { redirectTo: "/login" } });
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await submitValidSignupForm(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("TC-03: mutateAsync가 임의의 redirectTo로 응답하면 router.push가 해당 경로로 호출된다", async () => {
    mockMutateAsync.mockResolvedValue({ data: { redirectTo: "/custom-path" } });
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await submitValidSignupForm(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/custom-path");
    });
  });

  it("TC-04: 프론트엔드는 redirectTo 값을 그대로 사용하며 경로를 추론하지 않는다", async () => {
    const redirectTo = "/arbitrary-route-456";
    mockMutateAsync.mockResolvedValue({ data: { redirectTo } });
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await submitValidSignupForm(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(redirectTo);
      expect(mockPush).not.toHaveBeenCalledWith("/verify-email");
      expect(mockPush).not.toHaveBeenCalledWith("/login");
    });
  });
});
