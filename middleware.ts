import { type NextRequest, NextResponse } from "next/server";

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
 * redirect 시 baseResponse의 cookie를 보존
 *
 * 이유:
 * - updateSession(request)가 session refresh / cookie sync를 수행할 수 있음
 * - redirect 응답을 새로 만들면 baseResponse에 설정된 cookie가 유실될 수 있음
 * - 따라서 redirect 응답에도 기존 cookie 변경사항을 복사한다
 *
 * 현재 사용처:
 * - /reset-password 접근 시 session이 없으면 /forgot-password로 보냄
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
 * 정책:
 * - /reset-password 접근 가능 여부는 Supabase session만 기준으로 판단
 * - /reset-password 외 경로는 강제 차단하지 않고 그대로 통과
 *
 * 흐름:
 * 1. updateSession(request)로 session refresh / cookie sync 수행
 * 2. /reset-password가 아니면 그대로 통과
 * 3. /reset-password인데 session이 없으면 /forgot-password로 redirect
 * 4. /reset-password이고 session이 있으면 통과
 */
export async function middleware(request: NextRequest) {
  const baseResponse = await updateSession(request);
  const path = getPathname(request);

  if (!isResetPasswordPath(path)) {
    return baseResponse;
  }

  const session = await getSessionFromMiddlewareRequest(request);

  if (!session) {
    const redirectUrl = new URL(ROUTES.FORGOT_PASSWORD, request.url);
    return redirectWithPreservedResponse(baseResponse, redirectUrl);
  }

  return baseResponse;
}

export const config = {
  matcher: [
    // send-email hook은 서버-투-서버 호출이라 사용자 세션 미들웨어를 타면 인증 토큰 오류가 발생한다.
    "/((?!_next/static|_next/image|favicon.ico|(?:sw|swe-worker-.*)\\.js(?:\\.map)?|api/auth/hooks/send-email|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
