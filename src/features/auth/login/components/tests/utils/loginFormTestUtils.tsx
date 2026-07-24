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
 * 공통으로 사용하는 mock 함수들의 상태를 초기화한다.
 *
 * 왜 필요한가:
 * - mock 함수는 이전 테스트의 호출 기록과 반환 상태를 유지할 수 있다
 * - reset하지 않으면 테스트 간 간섭이 발생해 결과 신뢰도가 떨어진다
 *
 * 설계 의도:
 * - 전역 초기화(vi.clearAllMocks) 대신 실제로 공유하는 mock만 명시적으로 reset한다
 * - 테스트 영향 범위를 좁혀 불필요한 초기화를 피한다
 */
function resetSharedMocks() {
  mockMutateAsync.mockReset();
  mockPush.mockReset();
}

/**
 * useLoginMutation의 기본 mock 반환값을 설정한다.
 *
 * 왜 분리했는가:
 * - mutation 관련 mock 책임을 router/searchParams와 분리해
 *   각 mock의 역할을 명확히 유지하기 위해서다
 *
 * 동작:
 * - mutateAsync는 공통 mock 함수를 사용한다
 * - isPending은 테스트 시나리오에 따라 주입한다
 */
function mockLoginMutation(isPending = false) {
  vi.mocked(useLoginMutation).mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending,
  } as unknown as ReturnType<typeof useLoginMutation>);
}

/**
 * useRouter mock을 최소 인터페이스로 설정한다.
 *
 * 왜 push만 제공하는가:
 * - LoginForm은 router.push만 실제로 사용한다
 * - 사용하지 않는 메서드까지 mock하면 테스트가 불필요한 의존성을 허용하게 된다
 *
 * 설계 원칙:
 * - 필요한 것만 mock하는 최소 mock 원칙을 유지한다
 */
function mockRouter() {
  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
  } as unknown as ReturnType<typeof useRouter>);
}

/**
 * useSearchParams mock을 설정한다.
 *
 * 왜 get만 제공하는가:
 * - LoginForm은 searchParams.get("redirect")만 사용한다
 * - URLSearchParams 전체를 흉내 내는 것은 과도한 mock이기 때문이다
 *
 * 동작:
 * - redirect key에 대해서만 주입된 값을 반환한다
 * - 그 외 key는 null을 반환한다
 */
function mockSearchParams({
  redirectQuery = null,
  oauthError = null,
}: {
  redirectQuery?: string | null;
  oauthError?: string | null;
} = {}) {
  vi.mocked(useSearchParams).mockReturnValue({
    get: vi.fn((key: string) => {
      if (key === "redirect") return redirectQuery;
      if (key === "oauth_error") return oauthError;

      return null;
    }),
  } as unknown as ReturnType<typeof useSearchParams>);
}

/**
 * 공통 테스트 mock 환경을 기본 상태로 설정한다.
 *
 * 역할:
 * - useLoginMutation, useRouter, useSearchParams의 기본 mock 구현을 설정한다
 * - 공통 mock 함수(mockMutateAsync, mockPush)의 상태를 초기화한다
 *
 * 사용 방식:
 * - 각 테스트의 beforeEach에서 호출해 테스트 간 상태 오염을 방지한다
 * - 개별 테스트에서는 필요한 시나리오만 override한다
 *
 * 설계 의도:
 * - 공통 mock 초기화 책임을 이 함수로 집중시켜 전역 초기화 사용을 제거한다
 * - 테스트 파일이 mock 설정보다 시나리오 정의에 집중하도록 한다
 * - 내부 구현을 mutation / router / searchParams 단위로 나눠 유지보수를 쉽게 한다
 */
export function setupDefaultMocks({
  isPending = false,
  redirectQuery = null,
  oauthError = null,
}: {
  isPending?: boolean;
  redirectQuery?: string | null;
  oauthError?: string | null;
} = {}) {
  resetSharedMocks();
  mockLoginMutation(isPending);
  mockRouter();
  mockSearchParams({ redirectQuery, oauthError });
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
