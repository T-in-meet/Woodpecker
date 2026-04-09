import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VerifyEmailPage from "@/app/(auth)/verify-email/page";

vi.mock(
  "@/features/auth/verify-email/components/VerifyEmailPageClient",
  () => ({
    default: ({ email }: { email?: string }) => (
      <div>
        <p>회원가입이 완료되었습니다</p>
        {email && <span>{email}</span>}
        <button>인증 메일 재발송</button>
      </div>
    ),
  }),
);

describe("VerifyEmailPage", () => {
  it("이메일 인증 안내 페이지를 렌더링한다", async () => {
    const page = await VerifyEmailPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByText(/회원가입이 완료되었습니다/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /인증 메일 재발송/i }),
    ).toBeInTheDocument();
  });

  it("searchParams의 email을 VerifyEmailPageClient에 전달한다", async () => {
    const page = await VerifyEmailPage({
      searchParams: Promise.resolve({ email: "user@example.com" }),
    });
    render(page);

    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });
});
