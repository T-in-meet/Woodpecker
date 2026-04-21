import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import { vi } from "vitest";

import { LoginForm } from "@/features/auth/login/components/LoginForm";
import { useLoginMutation } from "@/features/auth/login/hooks/useLoginMutation";

vi.mock("next/navigation");
vi.mock("@/features/auth/login/hooks/useLoginMutation");

/**
 * 공통 mock 선언 영역
 *
 * 역할:
 * - next/navigation, useLoginMutation에 대한 vi.mock을 한 번만 선언한다
 * - 이 파일을 import하는 테스트는 별도의 vi.mock 선언 없이 동일한 mock 환경을 사용한다
 *
 * 주의:
 * - 각 테스트 파일에서 vi.mock(...)을 다시 선언하지 않는다
 * - mock 초기화는 setupDefaultMocks()를 통해 수행한다
 */

export const mockMutateAsync = vi.fn();
export const mockPush = vi.fn();

/**
 * 테스트 전용 QueryClient를 생성한다.
 *
 * 역할:
 * - 테스트 간 cache 공유를 방지하기 위해 매 테스트마다 새로운 인스턴스를 생성한다
 * - retry를 비활성화하여 테스트의 예측 가능성을 높인다
 *
 * 사용 방식:
 * - query-invalidation 테스트에서는 이 인스턴스에 spy를 설정한 뒤
 *   renderLoginForm(queryClient)로 동일 인스턴스를 주입해야 한다
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/**
 * 공통 테스트 mock 환경을 초기 상태로 복구한다.
 *
 * 역할:
 * - useLoginMutation, useRouter, useSearchParams의 기본 mock 구현을 설정한다
 * - 모든 공통 mock 함수(mockMutateAsync, router 관련 함수 등)를 reset한다
 *
 * 사용 방식:
 * - 각 테스트의 beforeEach에서 호출하여 테스트 간 상태 오염을 방지한다
 * - 개별 테스트에서는 mockMutateAsync.mockResolvedValue / mockRejectedValue 등으로
 *   필요한 시나리오만 override한다
 *
 * 설계 의도:
 * - 공통 mock 초기화 책임을 이 함수로 집중시켜
 *   vi.clearAllMocks 같은 전역 초기화 사용을 제거한다
 * - 테스트 파일은 "mock 설정"이 아니라 "시나리오 정의"에 집중하도록 한다
 */
export function setupDefaultMocks({
  isPending = false,
  redirectQuery = null,
}: {
  isPending?: boolean;
  redirectQuery?: string | null;
} = {}) {
  mockMutateAsync.mockReset();
  mockPush.mockReset();

  vi.mocked(useLoginMutation).mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending,
  } as unknown as ReturnType<typeof useLoginMutation>);

  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
  } as unknown as ReturnType<typeof useRouter>);

  vi.mocked(useSearchParams).mockReturnValue({
    get: vi
      .fn()
      .mockImplementation((key: string) =>
        key === "redirect" ? redirectQuery : null,
      ),
  } as unknown as ReturnType<typeof useSearchParams>);
}

/**
 * LoginForm을 QueryClientProvider와 함께 렌더링한다.
 *
 * 역할:
 * - 테스트 환경에서 사용할 QueryClient를 Provider로 주입한다
 *
 * 사용 방식:
 * - 기본적으로 내부에서 새로운 QueryClient를 생성한다
 * - query-invalidation 검증 시에는 외부에서 생성한 queryClient를 전달하여
 *   spy 대상과 실제 사용 인스턴스를 일치시켜야 한다
 */
export function renderLoginForm(queryClient = createTestQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginForm />
    </QueryClientProvider>,
  );
}
