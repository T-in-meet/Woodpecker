import { NextRequest } from "next/server";

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
