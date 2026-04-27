import { NextRequest } from "next/server";
import { vi } from "vitest";

import {
  checkIpRateLimitPrecheck,
  checkRequestEligibility,
} from "@/features/auth/lib/checkRequestEligibility";
import { parseAuthJsonRequestBody } from "@/features/auth/lib/parseAuthJsonRequestBody";
import { createClient } from "@/lib/supabase/server";

export const mockSignIn = vi.fn();

/**
 * 로그인 API 테스트에서 공통으로 사용하는 Supabase auth mock을 연결한다.
 *
 * 역할:
 * - createClient()가 반환하는 auth.signInWithPassword를 mockSignIn으로 고정한다
 * - 각 테스트 파일이 createClient mock 구조를 반복 작성하지 않도록 공통화한다
 */
export function setupLoginApiMocks() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { signInWithPassword: mockSignIn },
  } as never);
}

/**
 * 로그인 API 테스트용 공통 mock 상태를 초기화한다.
 *
 * 역할:
 * - mockSignIn 호출 기록과 구현을 초기화한다
 * - 테스트 간 signInWithPassword 상태 오염을 방지한다
 */
export function resetLoginApiMocks() {
  mockSignIn.mockReset();
}

/**
 * signInWithPassword의 기본 성공 응답을 설정한다.
 *
 * 역할:
 * - 성공 흐름 테스트의 기본 상태를 공통으로 제공한다
 * - 개별 테스트는 실패/예외 케이스만 override하도록 만든다
 */
export function mockLoginSuccess() {
  mockSignIn.mockResolvedValue({
    data: { user: { id: "user-id" }, session: {} },
    error: null,
  });
}

/**
 * 로그인 API route 테스트용 NextRequest 생성 헬퍼
 *
 * 사용 목적:
 * - 매 테스트마다 동일한 Request 생성 코드를 반복하지 않도록 공통화
 * - redirect query parameter 유무를 쉽게 제어
 *
 * @param body 요청에 포함할 JSON payload
 * @param redirectTo URL에 붙일 redirect query parameter (선택)
 */
export function makeLoginRequest(
  body: object,
  redirectTo?: string,
): NextRequest {
  const url = redirectTo
    ? `http://localhost/api/auth/login?redirect=${encodeURIComponent(redirectTo)}`
    : "http://localhost/api/auth/login";

  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * 유효한 로그인 요청 body 기본값
 * 테스트에서 공통으로 사용하는 정상 payload
 */
export const DEFAULT_LOGIN_BODY = {
  email: "user@example.com",
  password: "Password123!",
} as const;

/**
 * 로그인 API 테스트에서 파싱된 request body의 기본값을 설정한다.
 *
 * 역할:
 * - parseAuthJsonRequestBody의 반환값을 고정하여
 *   JSON 파싱/validation 단계를 통과한 상태를 만든다
 * - 기본값(email, password)을 제공하고 필요한 경우 일부 필드만 override할 수 있다
 *
 * 설계 의도:
 * - 각 테스트에서 동일한 body mock을 반복 작성하지 않도록 공통화한다
 * - 테스트는 "입력 변형"이 필요한 경우에만 overrides로 차이만 정의하도록 한다
 */
export function mockParsedLoginBody(
  overrides?: Partial<{
    email: string;
    password: string;
  }>,
) {
  vi.mocked(parseAuthJsonRequestBody).mockResolvedValue({
    email: "user@example.com",
    password: "Password1!",
    ...overrides,
  });
}

/**
 * 로그인 API 테스트에서 IP rate limit precheck를 항상 통과하도록 설정한다.
 *
 * 역할:
 * - checkIpRateLimitPrecheck가 allowed 상태를 반환하도록 고정한다
 * - 기본 흐름 테스트에서 rate limit 분기를 우회한다
 *
 * 설계 의도:
 * - 대부분의 테스트는 rate limit이 아닌 정상/에러 흐름을 검증하므로
 *   기본값을 "허용"으로 두고 차단 시나리오만 개별 테스트에서 override한다
 */
export function mockIpPrecheckAllowed() {
  vi.mocked(checkIpRateLimitPrecheck).mockReturnValue({ allowed: true });
}

/**
 * 로그인 API 테스트에서 요청 eligibility 검사를 항상 통과하도록 설정한다.
 *
 * 역할:
 * - checkRequestEligibility가 allowed 상태를 반환하도록 고정한다
 * - short/long window rate limit 분기를 기본적으로 우회한다
 *
 * 설계 의도:
 * - 기본 테스트 흐름에서는 eligibility 차단을 고려하지 않도록 하고
 *   rate limit 시나리오는 개별 테스트에서만 명시적으로 override한다
 */
export function mockEligibilityAllowed() {
  vi.mocked(checkRequestEligibility).mockReturnValue({ allowed: true });
}
