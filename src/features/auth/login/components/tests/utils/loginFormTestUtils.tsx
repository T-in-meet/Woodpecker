import { render } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import { vi } from "vitest";

import { useLoginMutation } from "@/features/auth/login/hooks/useLoginMutation";

import { LoginForm } from "../../LoginForm";

// 각 테스트 파일에서 vi.mock("next/navigation")과
// vi.mock("@/features/auth/login/hooks/useLoginMutation")을 선언한 후
// setupDefaultMocks를 호출해야 한다.

export const mockMutateAsync = vi.fn();
export const mockPush = vi.fn();

/**
 * useLoginMutation, useRouter, useSearchParams를 기본 상태로 설정한다.
 * 각 테스트에서 mockMutateAsync.mockRejectedValue 등으로 개별 override 가능.
 */
export function setupDefaultMocks({
  isPending = false,
  redirectQuery = null,
}: {
  isPending?: boolean;
  redirectQuery?: string | null;
} = {}) {
  vi.mocked(useLoginMutation).mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending,
  } as unknown as ReturnType<typeof useLoginMutation>);

  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  });

  vi.mocked(useSearchParams).mockReturnValue({
    get: vi
      .fn()
      .mockImplementation((key: string) =>
        key === "redirect" ? redirectQuery : null,
      ),
  } as unknown as ReturnType<typeof useSearchParams>);
}

/** LoginForm을 렌더링한다. */
export function renderLoginForm() {
  return render(<LoginForm />);
}
