import { NextRequest, NextResponse } from "next/server";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { applyMinimumResponseTime } from "@/features/auth/lib/applyMinimumResponseTime";
import { logCallback, logRequested } from "@/features/auth/lib/authLogger";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

const REDIRECT_OPTIONS = { status: 307 } as const;

/**
 * callback redirect에 사용할 공개 origin을 결정한다.
 *
 * 우선순위:
 * 1) APP_URL 환경변수 (서버 설정값, 공격자 조작 불가)
 * 2) request.url origin fallback (Next.js 내부 결정)
 *
 * 보안 — Open Redirect 방어:
 * - x-forwarded-proto / x-forwarded-host 헤더 신뢰 제거
 * - 헤더는 reverse proxy를 거치면서 조작 가능하므로 redirect destination 결정에 사용 금지
 * - APP_URL이 설정되지 않은 경우에도 request.url만 사용 (헤더 기반 origin 추론 제거)
 * - 이메일 callback 링크 클릭 시 공격자 도메인으로의 redirect 방지
 *
 * 운영 전제:
 * - APP_URL은 신뢰할 수 있는 서버 환경변수로만 설정되어야 함
 * - Vercel 배포: APP_URL 필수 설정
 * - 자체서버/ngrok: APP_URL 설정 필요 (미설정 시 request.url fallback 사용)
 * - 전제 변경(proxy 추가, 신뢰할 수 없는 헤더 가능성 등)이 생기면 보안 재검토 필요
 */
function resolvePublicOrigin(request: NextRequest): string {
  const appUrl = process.env["APP_URL"];

  // APP_URL 검증
  // - 잘못된 URL이면 즉시 실패시켜 설정 오류를 조기에 발견
  // - fallback을 허용하지 않는 이유:
  //   request.url 기반 origin은 환경에 따라 변조 가능성이 있어
  //   open redirect 및 잘못된 리다이렉트 위험이 있음
  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      throw new Error(`Invalid APP_URL: ${appUrl}`);
    }
  }

  // production에서는 APP_URL 필수
  // - 운영 환경에서 fallback을 허용하면 설정 오류가 숨겨짐
  // - 반드시 명시적으로 설정된 origin만 사용하도록 강제
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL must be set in production");
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

type CallbackInput = {
  tokenHash: string | null;
  type: string | null;
};

function extractCallbackInput(request: NextRequest): CallbackInput {
  return {
    tokenHash: request.nextUrl.searchParams.get("token_hash"),
    type: request.nextUrl.searchParams.get("type"),
  };
}

function isValidMagiclinkInput(input: CallbackInput): input is {
  tokenHash: string;
  type: "magiclink";
} {
  return Boolean(input.tokenHash) && input.type === "magiclink";
}

async function verifyMagiclinkToken(
  tokenHash: string,
): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });

    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/**
 * 이메일 인증 callback 처리
 *
 * 흐름:
 * 1. Supabase 표준 파라미터(token_hash, type) 추출
 * 2. 파라미터 누락 시 → /verify-email redirect
 * 3. type이 magiclink가 아니면 → /verify-email redirect
 * 4. Supabase verifyOtp 호출 (type: "magiclink" 고정)
 * 5. 성공(error 없음) → /mypage redirect
 * 6. 실패/예외 → /verify-email redirect
 *
 * 보안/설계 원칙:
 * - 커스텀 ticket 미사용, Supabase 표준 파라미터만 사용
 * - 상세 실패 원인을 외부에 노출하지 않음
 * - 모든 분기에서 최소 응답 시간 정책 적용 (Account Enumeration 방어)
 *   → verifyOtp 호출 여부, 네트워크 지연, Supabase 상태와 무관하게 동일 timing
 *   → 토큰 유효성, 계정 상태를 응답 시간 차이로 추론 불가능하도록 보장
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  logRequested(AUTH_EVENTS.AUTH_CALLBACK_REQUESTED, {
    path: request.nextUrl.pathname,
    method: request.method,
    provider: "email",
  });

  const finalize = (res: NextResponse): Promise<NextResponse> =>
    applyMinimumResponseTime(start, res) as Promise<NextResponse>;

  /**
   * 1) 입력 추출
   */
  const input = extractCallbackInput(request);

  /**
   * 2) 입력 검증
   */
  if (!isValidMagiclinkInput(input)) {
    // 주의:
    // 다른 *_FAILED 이벤트와 달리
    // AUTH_CALLBACK_FAILED는 "예외"가 아니라
    // verify-email로 귀결되는 정상 분기 결과를 의미한다.
    logCallback(AUTH_EVENTS.AUTH_CALLBACK_FAILED, {
      path: request.nextUrl.pathname,
      method: request.method,
      status: 307,
      provider: "email",
    });
    return finalize(redirectToVerifyEmail(request));
  }

  /**
   * 3) side-effect (Supabase verifyOtp)
   */
  const verification = await verifyMagiclinkToken(input.tokenHash);
  if (!verification.ok) {
    logCallback(AUTH_EVENTS.AUTH_CALLBACK_FAILED, {
      path: request.nextUrl.pathname,
      method: request.method,
      status: 307,
      provider: "email",
    });
    return finalize(redirectToVerifyEmail(request));
  }

  /**
   * 4) finalize redirect
   */
  logCallback(AUTH_EVENTS.AUTH_CALLBACK_COMPLETED, {
    path: request.nextUrl.pathname,
    method: request.method,
    status: 307,
    provider: "email",
  });
  return finalize(redirectToMypage(request));
}
