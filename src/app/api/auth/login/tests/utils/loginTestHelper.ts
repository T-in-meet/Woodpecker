import { NextRequest } from "next/server";
import { vi } from "vitest";

import { parseAuthJsonRequestBody } from "@/features/auth/lib/parseAuthJsonRequestBody";
import { getTrustedAuthClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";
import { loginRateLimit } from "@/features/auth/login/lib/loginRateLimit";
import { createClient } from "@/lib/supabase/server";

export const mockSignIn = vi.fn();
export const mockSignOut = vi.fn();

/**
 * 로그인 API 테스트에서 공통으로 사용하는 Supabase auth mock을 연결한다.
 */
export function setupLoginApiMocks(): void {
  vi.mocked(createClient).mockResolvedValue({
    auth: { signInWithPassword: mockSignIn, signOut: mockSignOut },
  } as never);
}

/**
 * Login Route의 trusted IP / Rate Limit 기본 허용 상태를 설정한다.
 */
export function setupLoginSecurityMocks(): void {
  vi.mocked(getTrustedAuthClientIp).mockReturnValue({
    available: true,
    ip: "127.0.0.1",
  });
  vi.mocked(loginRateLimit.tryStartAttempt).mockReturnValue({
    allowed: true,
  });
  vi.mocked(loginRateLimit.recordResult).mockReturnValue(undefined);
}

/**
 * 로그인 API 테스트용 mock 상태를 초기화한다.
 */
export function resetLoginApiMocks(): void {
  mockSignIn.mockReset();
  mockSignOut.mockReset();
  vi.mocked(createClient).mockReset();
  vi.mocked(getTrustedAuthClientIp).mockReset();
  vi.mocked(loginRateLimit.tryStartAttempt).mockReset();
  vi.mocked(loginRateLimit.recordResult).mockReset();
}

/**
 * signInWithPassword의 기본 성공 응답을 설정한다.
 */
export function mockLoginSuccess(): void {
  mockSignIn.mockResolvedValue({
    data: { user: { id: "user-id" }, session: {} },
    error: null,
  });
}

/**
 * 로그인 API route 테스트용 NextRequest 생성 헬퍼.
 *
 * @param body 요청 JSON payload
 * @param redirectTo redirect query parameter
 * @returns 테스트 NextRequest
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
 * 유효한 로그인 요청 body 기본값.
 */
export const DEFAULT_LOGIN_BODY = {
  email: "user@example.com",
  password: "Password123!",
} as const;

/**
 * 로그인 API 테스트에서 파싱된 request body를 설정한다.
 *
 * @param overrides 기본 body에서 덮어쓸 필드
 */
export function mockParsedLoginBody(
  overrides?: Partial<{
    email: string;
    password: string;
  }>,
): void {
  vi.mocked(parseAuthJsonRequestBody).mockResolvedValue({
    email: "user@example.com",
    password: "Password1!",
    ...overrides,
  });
}
