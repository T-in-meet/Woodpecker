import { type NextRequest, NextResponse } from "next/server";

import { RESET_REQUIRED_COOKIE_NAME } from "@/features/auth/constants/cookies";
import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { ROUTES } from "@/lib/constants/routes";
import {
  getSessionFromMiddlewareRequest,
  updateSession,
} from "@/lib/supabase/middleware";

/**
 * 요청 URL에서 pathname만 추출
 * - query / hash는 제외된 상태
 */
function getPathname(request: NextRequest): string {
  return request.nextUrl.pathname;
}

/**
 * reset-password 경로 여부
 */
function isResetPasswordPath(path: string): boolean {
  return path === ROUTES.RESET_PASSWORD;
}

/**
 * 접근 제어에서 제외되는 경로
 *
 * 정책:
 * - API, Next 내부 리소스, favicon 등은 접근 제어 대상 아님
 * - forgot-password, callback은 reset flow의 일부이므로 허용
 */
function isExceptionPath(path: string): boolean {
  return (
    path.startsWith("/api/") ||
    path.startsWith("/_next/") ||
    path === "/favicon.ico" ||
    path === "/api/auth/callback" ||
    path === ROUTES.FORGOT_PASSWORD
  );
}

/**
 * reset-required cookie 조회
 * - 존재 여부만 사용 (값 자체는 의미 없음)
 */
function getResetRequiredCookie(request: NextRequest): string | undefined {
  return request.cookies.get(RESET_REQUIRED_COOKIE_NAME)?.value;
}

/**
 * 강제 상태 판단
 *
 * 조건:
 * - session 존재
 * - reset-required cookie 존재
 *
 * 의미:
 * - recovery 완료 후 reset-password를 반드시 거쳐야 하는 상태
 */
function isForcedState(session: unknown, cookie?: string): boolean {
  return Boolean(session && cookie);
}

/**
 * redirect query 생성
 *
 * 정책:
 * - exception path / reset-password path는 보존하지 않음
 * - validateRedirectPath 기준 allowlist 적용
 * - fallback 값(`/mypage`)은 보존하지 않음
 *
 * 동작:
 * - validateRedirectPath(path) === path 인 경우에만 보존
 */
function buildRedirectQuery(path: string): string | null {
  if (isExceptionPath(path) || isResetPasswordPath(path)) {
    return null;
  }

  const validatedPath = validateRedirectPath(path);
  if (validatedPath !== path) {
    return null;
  }

  return path;
}

/**
 * redirect 시 baseResponse의 cookie를 보존
 *
 * 이유:
 * - updateSession에서 설정된 session cookie 유지 필요
 * - middleware 단계에서 cookie 유실 방지
 */
function redirectWithPreservedResponse(
  baseResponse: NextResponse,
  url: URL,
): NextResponse {
  const response = NextResponse.redirect(url, { status: 307 });
  for (const cookie of baseResponse.cookies.getAll()) {
    response.cookies.set(cookie.name, cookie.value, cookie);
  }
  return response;
}

/**
 * reset-password 접근 제어 middleware
 *
 * 전체 흐름:
 *
 * 1. updateSession → session refresh 수행
 * 2. exception path → 접근 제어 제외
 * 3. reset-password 접근:
 *    - session + cookie 없으면 차단
 * 4. 강제 상태:
 *    - reset-password 외 접근 시 강제 redirect
 * 5. 그 외 → 그대로 통과
 *
 * 중요:
 * - 분기 순서 변경 금지 (버그 가능성 있음)
 */
export async function middleware(request: NextRequest) {
  // session refresh + cookie sync
  const baseResponse = await updateSession(request);
  const path = getPathname(request);

  // 1. 접근 제어 제외 경로
  if (isExceptionPath(path)) {
    return baseResponse;
  }

  // session / cookie 조회
  const session = await getSessionFromMiddlewareRequest(request);
  const resetRequiredCookie = getResetRequiredCookie(request);

  // 2. reset-password 접근 제어
  if (isResetPasswordPath(path)) {
    if (!session || !resetRequiredCookie) {
      const redirectUrl = new URL(ROUTES.FORGOT_PASSWORD, request.url);
      return redirectWithPreservedResponse(baseResponse, redirectUrl);
    }

    return baseResponse;
  }

  // 3. 강제 상태 처리
  if (isForcedState(session, resetRequiredCookie)) {
    const redirectUrl = new URL(ROUTES.RESET_PASSWORD, request.url);
    const redirectPath = buildRedirectQuery(path);
    if (redirectPath) {
      redirectUrl.searchParams.set("redirect", redirectPath);
    }
    return redirectWithPreservedResponse(baseResponse, redirectUrl);
  }

  // 4. 기본 통과
  return baseResponse;
}

export const config = {
  matcher: [
    // send-email hook은 서버-투-서버 호출이라 사용자 세션 미들웨어를 타면 인증 토큰 오류가 발생한다.
    "/((?!_next/static|_next/image|favicon.ico|(?:sw|swe-worker-.*)\\.js(?:\\.map)?|api/auth/hooks/send-email|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
