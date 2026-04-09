/**
 * VerifyEmailPage (Server Component) 테스트
 *
 * 설계 의도:
 * - Server Component인 VerifyEmailPage의 책임만 검증한다.
 *   → searchParams를 파싱해 VerifyEmailPageClient에 올바르게 전달하는지 확인한다.
 * - VerifyEmailPageClient는 별도로 테스트하므로 여기서는 mock으로 대체한다.
 *   → 클라이언트 컴포넌트의 인터랙션을 이 테스트에 포함하면 책임이 중복된다.
 *
 * mock 전략:
 * - VerifyEmailPageClient를 최소한의 렌더링만 하는 stub으로 교체한다.
 * - email prop 전달 여부를 DOM 텍스트로 확인한다.
 *
 * async 처리:
 * - Next.js App Router에서 searchParams는 Promise이므로
 *   page 함수 자체가 async이며 테스트에서도 await로 호출한다.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VerifyEmailPage from "@/app/(auth)/verify-email/page";

// VerifyEmailPageClient를 stub으로 대체한다.
// 실제 클라이언트 로직은 VerifyEmailPageClient.test.tsx에서 검증한다.
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
