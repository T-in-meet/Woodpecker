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
 * callback redirect에 사용할 공개 origin을 결정한다.
 *
 * 우선순위:
 * 1) reverse proxy/ngrok 환경의 forwarded header
 * 2) APP_URL 환경변수
 * 3) request.url origin fallback
 */
function resolvePublicOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const appUrl = process.env["APP_URL"];

  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      // invalid APP_URL은 아래 request.url fallback 사용
    }
  }

  return new URL(request.url).origin;
}

/**
 * 공통 로그인 redirect 응답 생성
 *
 * 모든 분기에서 동일한 redirect 계약을 재사용하기 위한 helper.
 */
function redirectToLogin(request: NextRequest): NextResponse {
  const resolvedOrigin = resolvePublicOrigin(request);
  const redirectUrl = new URL(ROUTES.LOGIN, `${resolvedOrigin}/`);

  console.info("[auth-callback] redirect context", {
    requestUrl: request.url,
    pathname: request.nextUrl.pathname,
    host: request.headers.get("host"),
    xForwardedHost: request.headers.get("x-forwarded-host"),
    xForwardedProto: request.headers.get("x-forwarded-proto"),
    resolvedOrigin,
    redirectTo: redirectUrl.toString(),
  });

  return NextResponse.redirect(redirectUrl, LOGIN_REDIRECT);
}

type VerifyType = "signup" | "magiclink";

/**
 * decryptTicket 결과를 callback 처리용 의미 단위로 파싱한다.
 *
 * - notify ticket: 인증 처리 없이 로그인 이동
 * - verify ticket: verifyType(signup|magiclink) + token_hash 추출
 * - 구버전 ticket(raw token_hash): signup으로 하위호환 처리
 */
function parseTicketPayload(raw: string): {
  kind: "verify" | "notify";
  tokenHash?: string;
  verifyType?: VerifyType;
} {
  // notify ticket은 인증 상태 변경 없이 로그인 화면으로만 이동시키는 용도다.
  if (raw.startsWith("notify-") || raw.startsWith("notify:")) {
    return { kind: "notify" };
  }

  // magiclink/signup prefix로 verifyOtp type을 명확히 결정한다.
  if (raw.startsWith("magiclink:")) {
    const tokenHash = raw.slice("magiclink:".length);
    return { kind: "verify", tokenHash, verifyType: "magiclink" };
  }

  if (raw.startsWith("signup:")) {
    const tokenHash = raw.slice("signup:".length);
    return { kind: "verify", tokenHash, verifyType: "signup" };
  }

  // backward compatibility: 구버전 ticket은 token_hash 원문만 담고 있으므로 signup으로 해석한다.
  return { kind: "verify", tokenHash: raw, verifyType: "signup" };
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

  let decrypted: string;

  try {
    /**
     * ticket 복호화
     *
     * 현재 decryptTicket 계약은 token_hash 문자열 반환이다.
     */
    decrypted = decryptTicket(ticket);
  } catch {
    /**
     * 복호화 실패도 외부에는 동일 redirect
     */
    return redirectToLogin(request);
  }

  const parsed = parseTicketPayload(decrypted);

  if (parsed.kind === "notify") {
    // notify는 검증 API를 호출하지 않고 동일한 외부 응답(로그인 리다이렉트)만 유지한다.
    return redirectToLogin(request);
  }

  if (!parsed.tokenHash || !parsed.verifyType) {
    return redirectToLogin(request);
  }

  try {
    /**
     * ticket가 유효한 경우에만 Supabase client 생성 및 OTP 검증 수행
     */
    const supabase = await createClient();
    await supabase.auth.verifyOtp({
      type: parsed.verifyType,
      token_hash: parsed.tokenHash,
    });
  } catch {
    /**
     * verifyOtp 실패/예외 모두 외부에는 동일하게 처리
     */
  }

  return redirectToLogin(request);
}
