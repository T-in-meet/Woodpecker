import { NextRequest, NextResponse } from "next/server";

import { decryptTicket } from "@/features/auth/email/ticket";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * callback 처리 결과와 무관하게 로그인 페이지로 동일 redirect한다.
 *
 * 목적:
 * - 성공/실패/예외에 따른 외부 응답 차이를 제거
 * - callback을 stateless하게 유지
 */
const LOGIN_REDIRECT = { status: 307 } as const;

/**
 * 공통 로그인 redirect 응답 생성
 *
 * 모든 분기에서 동일한 redirect 계약을 재사용하기 위한 helper.
 */
function redirectToLogin(request: NextRequest): NextResponse {
  return NextResponse.redirect(
    new URL(ROUTES.LOGIN, request.url),
    LOGIN_REDIRECT,
  );
}

/**
 * 이메일 인증 callback 처리
 *
 * 흐름:
 * 1. ticket query 확인
 * 2. decryptTicket으로 token_hash 복원
 * 3. Supabase verifyOtp(type: "signup") 호출
 * 4. 결과와 무관하게 로그인 페이지로 redirect
 *
 * 보안/설계 원칙:
 * - ticket 누락, 복호화 실패, verifyOtp 실패/예외 모두 외부에는 동일 응답
 * - 상세 성공/실패 원인을 body나 query로 노출하지 않음
 * - callback은 추가 상태 저장 없이 stateless하게 처리
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  /**
   * 이메일 링크에 포함된 opaque ticket 추출
   */
  const ticket = request.nextUrl.searchParams.get("ticket");

  /**
   * ticket 누락 시 조기 종료
   */
  if (!ticket) {
    return redirectToLogin(request);
  }

  let tokenHash: string;

  try {
    /**
     * ticket 복호화
     *
     * 현재 decryptTicket 계약은 token_hash 문자열 반환이다.
     */
    tokenHash = decryptTicket(ticket);
  } catch {
    /**
     * 복호화 실패도 외부에는 동일 redirect
     */
    return redirectToLogin(request);
  }

  try {
    /**
     * ticket가 유효한 경우에만 Supabase client 생성 및 OTP 검증 수행
     */
    const supabase = await createClient();
    await supabase.auth.verifyOtp({ type: "signup", token_hash: tokenHash });
  } catch {
    /**
     * verifyOtp 실패/예외 모두 외부에는 동일하게 처리
     */
  }

  return redirectToLogin(request);
}
