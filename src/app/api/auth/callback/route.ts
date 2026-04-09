import { NextRequest, NextResponse } from "next/server";

import { applyMinimumResponseTime } from "@/features/auth/lib/applyMinimumResponseTime";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

const REDIRECT_OPTIONS = { status: 307 } as const;

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

function redirectToMypage(request: NextRequest): NextResponse {
  const origin = resolvePublicOrigin(request);
  const redirectUrl = new URL(ROUTES.MYPAGE, `${origin}/`);
  return NextResponse.redirect(redirectUrl, REDIRECT_OPTIONS);
}

function redirectToVerifyEmail(request: NextRequest): NextResponse {
  const origin = resolvePublicOrigin(request);
  const redirectUrl = new URL(ROUTES.VERIFY_EMAIL, `${origin}/`);
  return NextResponse.redirect(redirectUrl, REDIRECT_OPTIONS);
}

/**
 * 이메일 인증 callback 처리
 *
 * 흐름:
 * 1. Supabase 표준 파라미터(token_hash, type) 추출
 * 2. 파라미터 누락 시 → /verify-email redirect
 * 3. Supabase verifyOtp 호출
 * 4. 성공(error 없음) → /mypage redirect
 * 5. 실패/예외 → /verify-email redirect
 *
 * 보안/설계 원칙:
 * - 커스텀 ticket 미사용, Supabase 표준 파라미터만 사용
 * - 상세 실패 원인을 외부에 노출하지 않음
 * - 모든 분기에서 최소 응답 시간 정책 적용
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const finalize = (res: NextResponse): Promise<NextResponse> =>
    applyMinimumResponseTime(start, res) as Promise<NextResponse>;

  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (!tokenHash || !type) {
    return finalize(redirectToVerifyEmail(request));
  }

  if (type !== "signup" && type !== "magiclink") {
    return finalize(redirectToVerifyEmail(request));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "magiclink",
    });

    if (error) {
      return finalize(redirectToVerifyEmail(request));
    }
  } catch {
    return finalize(redirectToVerifyEmail(request));
  }

  return finalize(redirectToMypage(request));
}
