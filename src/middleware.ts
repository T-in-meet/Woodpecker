import { type NextRequest, NextResponse } from "next/server";

import {
  getBlockedAuthPageRedirectPath,
  isAuthAccessControlledPath,
} from "@/features/auth/utils/authPageAccessPolicy";
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
 * redirect 시 baseResponse의 cookie를 보존
 *
 * 이유:
 * - updateSession(request)가 session refresh / cookie sync를 수행할 수 있음
 * - redirect 응답을 새로 만들면 baseResponse에 설정된 cookie가 유실될 수 있음
 * - 따라서 redirect 응답에도 기존 cookie 변경사항을 복사한다
 *
 * 현재 사용처:
 * - 인증 페이지 접근 정책에 따라 redirect가 필요한 경우
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
 * 인증 페이지 접근 제어 middleware
 *
 * 정책:
 * - 로그인 사용자는 guest-only 인증 페이지에 접근할 수 없음
 * - 비로그인 사용자는 session-required 인증 페이지에 접근할 수 없음
 * - 접근 제어 대상이 아닌 경로는 강제 차단하지 않고 그대로 통과
 *
 * 흐름:
 * 1. updateSession(request)로 session refresh / cookie sync 수행
 * 2. 접근 제어 대상 auth page가 아니면 그대로 통과
 * 3. 접근 제어 대상이면 Supabase session을 조회
 * 4. 정책상 차단 대상이면 지정된 경로로 redirect
 * 5. 차단 대상이 아니면 통과
 */
export async function middleware(request: NextRequest) {
  const baseResponse = await updateSession(request);

  const pathname = getPathname(request);

  if (!isAuthAccessControlledPath(pathname)) {
    return baseResponse;
  }

  const session = await getSessionFromMiddlewareRequest(request);

  const redirectPath = getBlockedAuthPageRedirectPath({
    pathname,
    hasSession: Boolean(session),
  });

  if (!redirectPath) {
    return baseResponse;
  }

  const redirectUrl = new URL(redirectPath, request.url);

  return redirectWithPreservedResponse(baseResponse, redirectUrl);
}

export const config = {
  matcher: [
    // send-email hook은 서버-투-서버 호출이라 사용자 세션 미들웨어를 타면 인증 토큰 오류가 발생한다.
    "/((?!_next/static|_next/image|favicon.ico|(?:sw|swe-worker-.*)\\.js(?:\\.map)?|api/auth/hooks/send-email|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
