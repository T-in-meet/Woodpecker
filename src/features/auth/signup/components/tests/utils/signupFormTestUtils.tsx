import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { vi } from "vitest";

import { SignupForm } from "@/features/auth/signup/components/SignupForm";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

// SignupForm 테스트 공통 유틸
// - 반복되는 렌더링 코드를 한 곳으로 모아 테스트 파일 간 중복을 줄인다.
// - 기본 onSubmit mock과 isPending 기본값을 제공해 각 테스트가 의도에만 집중하도록 돕는다.
// - 구조/검증/제출/반응형 테스트에서 공통으로 사용한다.

// SignupForm을 기본 props와 함께 렌더링하는 헬퍼
// - 필요한 경우 onSubmit, isPending만 override해서 사용한다.
export function renderSignupForm({
  onSubmit = vi.fn(),
  isPending = false,
}: Partial<ComponentProps<typeof SignupForm>> = {}) {
  return {
    onSubmit,
    ...render(<SignupForm onSubmit={onSubmit} isPending={isPending} />),
  };
}
