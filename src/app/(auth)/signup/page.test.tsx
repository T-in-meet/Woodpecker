// React Testing Library: 컴포넌트 렌더링 및 DOM 조회
import { render, screen } from "@testing-library/react";
// Vitest: 테스트 실행 및 mocking 유틸
import { describe, expect, it, vi } from "vitest";

// 테스트 대상: Next.js 페이지 컴포넌트
import SignupPage from "@/app/(auth)/signup/page";

/**
 * next/navigation mock
 * - 실제 router 동작을 막고 테스트에서 제어 가능한 mock으로 대체
 * - push 함수가 호출되는지만 검증하기 위함
 */
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(), // 라우팅 호출 여부 확인용 mock 함수
  })),
}));

/**
 * useSignupMutation mock
 * - 실제 API 요청을 막고 테스트에서 상태를 고정
 * - mutateAsync 호출 여부 및 payload 검증을 위해 사용
 */
vi.mock("@/features/auth/signup/hooks/useSignupMutation", () => ({
  useSignupMutation: vi.fn(() => ({
    mutateAsync: vi.fn(), // 회원가입 요청 mock
    isPending: false, // 로딩 상태 false로 고정
  })),
}));

describe("SignupPage", () => {
  it("회원가입 폼을 렌더링한다", () => {
    // 페이지 컴포넌트 렌더링
    render(<SignupPage />);

    // 접근성 기준: role="form" + name="회원가입" 폼이 존재하는지 확인
    expect(screen.getByRole("form", { name: /회원가입/i })).toBeInTheDocument();
  });
});
