import { NextRequest, NextResponse } from "next/server";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import {
  RESET_REQUIRED_COOKIE_NAME,
  RESET_REQUIRED_COOKIE_OPTIONS,
} from "@/features/auth/constants/cookies";
import { applyMinimumResponseTime } from "@/features/auth/lib/applyMinimumResponseTime";
import {
  logAuthError,
  logCallback,
  logRequested,
  normalizeUnknownError,
} from "@/features/auth/lib/authLogger";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

const REDIRECT_OPTIONS = { status: 307 } as const;

/**
 * callback redirect에 사용할 공개 origin을 결정한다.
 *
 * 우선순위:
 * 1) APP_URL 환경변수 (서버 설정값, 공격자 조작 불가)
 *
 * 보안 — Open Redirect 방어:
 * - x-forwarded-proto / x-forwarded-host 헤더 신뢰 제거
 * - 헤더는 reverse proxy를 거치면서 조작 가능하므로 redirect destination 결정에 사용 금지
 * - request.url 기반 fallback 금지
 * - 이메일 callback 링크 클릭 시 공격자 도메인으로의 redirect 방지
 *
 * 운영 전제:
 * - APP_URL은 신뢰할 수 있는 서버 환경변수로만 설정되어야 함
 * - Vercel 배포: APP_URL 필수 설정
 * - 자체서버/ngrok: APP_URL 설정 필요
 * - 전제 변경(proxy 추가, 신뢰할 수 없는 헤더 가능성 등)이 생기면 보안 재검토 필요
 */
function resolvePublicOrigin(): string {
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

  throw new Error("APP_URL must be set");
}

function redirectToMypage(): NextResponse {
  const origin = resolvePublicOrigin();
  const redirectUrl = new URL(ROUTES.MYPAGE, `${origin}/`);
  return NextResponse.redirect(redirectUrl, REDIRECT_OPTIONS);
}

function redirectToVerifyEmail(): NextResponse {
  const origin = resolvePublicOrigin();
  const redirectUrl = new URL(ROUTES.VERIFY_EMAIL, `${origin}/`);
  return NextResponse.redirect(redirectUrl, REDIRECT_OPTIONS);
}

// callback query를 내부 처리용 shape으로 정규화한다.
// redirect는 magiclink에서는 사용하지 않지만 recovery redirect 보존을 위해 항상 포함한다.
type CallbackInput = {
  tokenHash: string | null;
  type: string | null;
  redirect: string | null;
};

type ValidMagiclinkInput = CallbackInput & {
  tokenHash: string;
  type: "magiclink";
};

function extractCallbackInput(request: NextRequest): CallbackInput {
  return {
    tokenHash: request.nextUrl.searchParams.get("token_hash"),
    type: request.nextUrl.searchParams.get("type"),
    redirect: request.nextUrl.searchParams.get("redirect"),
  };
}

// magiclink 분기는 기존 이메일 인증 callback 동작을 보존한다.
// recovery 추가로 인해 기존 verifyOtp 인자나 redirect 정책이 바뀌면 안 된다.
function isValidMagiclinkInput(
  input: CallbackInput,
): input is ValidMagiclinkInput {
  return Boolean(input.tokenHash) && input.type === "magiclink";
}

async function verifyMagiclinkToken(
  tokenHash: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  return { ok: !error };
}

// recovery는 token_hash와 type=recovery만 검증한다.
// redirect는 여기서 검증하지 않고 reset-password 단계까지 보존만 한다.
function isValidRecoveryInput(input: CallbackInput): input is {
  tokenHash: string;
  type: "recovery";
  redirect: string | null;
} {
  return Boolean(input.tokenHash) && input.type === "recovery";
}

async function verifyRecoveryToken(
  tokenHash: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  return { ok: !error };
}

// recovery 성공 후 reset-password로만 이동한다.
// redirect query는 최종 이동 경로가 아니라 reset-password 단계에서 사용할 후보값으로만 전달한다.
function redirectToResetPassword(redirect: string | null): NextResponse {
  const origin = resolvePublicOrigin();
  const redirectUrl = new URL(ROUTES.RESET_PASSWORD, `${origin}/`);

  if (redirect) {
    redirectUrl.searchParams.set("redirect", redirect);
  }

  return NextResponse.redirect(redirectUrl, REDIRECT_OPTIONS);
}

function redirectToForgotPasswordInvalidLink(): NextResponse {
  const origin = resolvePublicOrigin();
  const redirectUrl = new URL(ROUTES.FORGOT_PASSWORD, `${origin}/`);
  redirectUrl.searchParams.set("error", "invalid_reset_link");
  return NextResponse.redirect(redirectUrl, REDIRECT_OPTIONS);
}

/**
 * reset-password 접근 제어용 reset-required cookie 생성
 * - 생성 시점: recovery verifyOtp 성공 직후에만 호출
 * - 사용 위치: reset-password 단계에서 접근 제어
 * - 제약: token/email/redirect 등 민감 정보나 사용자 입력 포함 금지
 */
function setResetRequiredCookie(response: NextResponse): void {
  response.cookies.set(
    RESET_REQUIRED_COOKIE_NAME,
    "true",
    RESET_REQUIRED_COOKIE_OPTIONS,
  );
}

/**
 * Auth Callback Route
 *
 * 역할:
 * - Supabase 인증 관련 callback을 단일 진입점에서 처리
 * - PKCE(code) 방식과 token_hash 방식 모두 지원
 *
 * 지원 흐름:
 *
 * 1. 이메일 인증 (magiclink)
 *    - 입력: token_hash + type=magiclink
 *    - 처리: verifyOtp(token_hash)
 *    - 성공: /mypage 이동
 *    - 실패: /verify-email 이동
 *
 * 2. 비밀번호 재설정 (recovery - PKCE)
 *    - 입력: type=recovery + code
 *    - 처리: exchangeCodeForSession(code)
 *    - 성공:
 *        - reset-required cookie 설정
 *        - /reset-password 이동 (redirect query 보존)
 *    - 실패:
 *        - /forgot-password?error=invalid_reset_link 이동
 *
 * 3. 비밀번호 재설정 (recovery - token_hash)
 *    - 입력: token_hash + type=recovery
 *    - 처리: verifyOtp(token_hash)
 *    - 성공:
 *        - reset-required cookie 설정
 *        - /reset-password 이동 (redirect query 보존)
 *    - 실패:
 *        - /forgot-password?error=invalid_reset_link 이동
 *
 * 4. 지원하지 않는 요청
 *    - 입력: type 없음 / 알 수 없는 type / code only
 *    - 처리:
 *        - /verify-email 이동
 *
 * 보안 정책:
 * - recovery 성공 시에만 reset-required cookie 설정
 * - 실패 시 원인 노출 없이 일관된 redirect 처리
 * - 최소 응답 시간(applyMinimumResponseTime) 적용
 *
 * 참고:
 * - Supabase recovery 메일은 PKCE 방식(code)을 기본 사용
 * - token_hash 방식은 하위 호환 및 특정 케이스 대응용으로 유지
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

  type CallbackTerminalOutcome = "completed" | "rejected" | "failed";
  type CallbackFlow = "magiclink" | "recovery" | "unknown";

  let outcome: CallbackTerminalOutcome;
  let response: NextResponse;
  let flow: CallbackFlow = "unknown";
  let failureMeta: { errorMessage: string; errorName: string } | null = null;

  try {
    /**
     * 1) 입력 추출
     */
    const input = extractCallbackInput(request);

    /**
     * 2) 입력 검증
     */
    if (input.type === "magiclink") {
      flow = "magiclink";

      if (!isValidMagiclinkInput(input)) {
        outcome = "rejected";
        response = redirectToVerifyEmail();
      } else {
        /**
         * 3) side-effect (Supabase verifyOtp)
         */
        const verification = await verifyMagiclinkToken(input.tokenHash);

        if (!verification.ok) {
          outcome = "rejected";
          response = redirectToVerifyEmail();
        } else {
          /**
           * 4) finalize redirect
           */
          outcome = "completed";
          response = redirectToMypage();
        }
      }
    } else if (input.type === "recovery") {
      flow = "recovery";

      if (!isValidRecoveryInput(input)) {
        outcome = "rejected";
        response = redirectToForgotPasswordInvalidLink();
      } else {
        const verification = await verifyRecoveryToken(input.tokenHash);

        if (!verification.ok) {
          outcome = "rejected";
          response = redirectToForgotPasswordInvalidLink();
        } else {
          outcome = "completed";
          response = redirectToResetPassword(input.redirect);

          // cookie는 redirect response에 설정해야 브라우저가 reset-password 진입 전에 저장한다.
          setResetRequiredCookie(response);
        }
      }
    } else {
      /**
       * unsupported type은 기존 callback 정책 유지 (verify-email redirect)
       * TODO: recovery(reset-password) 흐름과의 정책 불일치 존재 → callback 정책 통합 시 재정의 필요
       */
      outcome = "rejected";
      response = redirectToVerifyEmail();
    }
  } catch (error) {
    const { errorMessage, errorName } = normalizeUnknownError(error);
    failureMeta = { errorMessage, errorName };
    outcome = "failed";
    response =
      flow === "recovery"
        ? redirectToForgotPasswordInvalidLink()
        : redirectToVerifyEmail();
  }

  // callback은 외부 동작이 동일한 redirect(307)여도
  // 내부 원인 구분을 위해 REJECTED(예상 거부)와 FAILED(예외)를 분리 기록한다.
  if (outcome === "failed") {
    logAuthError(AUTH_EVENTS.AUTH_CALLBACK_FAILED, {
      path: request.nextUrl.pathname,
      method: request.method,
      status: response.status,
      provider: "email",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      ...(failureMeta?.errorMessage
        ? { errorMessage: failureMeta.errorMessage }
        : {}),
      ...(failureMeta?.errorName ? { errorName: failureMeta.errorName } : {}),
    });
  } else {
    logCallback(
      outcome === "completed"
        ? AUTH_EVENTS.AUTH_CALLBACK_COMPLETED
        : AUTH_EVENTS.AUTH_CALLBACK_REJECTED,
      {
        path: request.nextUrl.pathname,
        method: request.method,
        status: response.status,
        provider: "email",
      },
    );
  }

  return finalize(response);
}
