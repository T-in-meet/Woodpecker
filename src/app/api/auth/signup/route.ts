import { NextRequest } from "next/server";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { issueAuthEmailLinkAndSend } from "@/features/auth/email/issueAuthEmailLinkAndSend";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { applyMinimumResponseTime } from "@/features/auth/lib/applyMinimumResponseTime";
import {
  checkIpRateLimitPrecheck,
  checkRequestEligibility,
} from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { mapSignupValidationErrors } from "@/features/auth/signup/lib/mapSignupValidationErrors";
import { signupApiSchema } from "@/features/auth/signup/schema/signupApiSchema";
import { failureResponse, successResponse } from "@/lib/api/response";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalizeEmail } from "@/lib/utils/canonicalizeEmail";
import { getClientIp } from "@/lib/utils/getClientIp";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

/**
 * JSON 파싱 실패를 명확하게 구분하기 위한 커스텀 에러
 *
 * 목적:
 * - request.json() 실패를 일반 에러와 구분
 * - validation 이전 단계에서 동일한 실패 응답을 반환하기 위함
 */
class JsonParseError extends Error {}

/**
 * 요청 파싱 함수
 *
 * 역할:
 * - JSON 요청 본문 파싱
 *
 * 보안 관점:
 * - 이 단계는 계정 상태와 무관한 입력 처리 단계
 * - 어떤 경우에도 계정 존재 여부와 연결되면 안됨
 */
async function parseRequest(request: NextRequest): Promise<unknown> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new JsonParseError();
  }

  return body;
}
/**
 * 회원가입 핵심 로직
 *
 * POST 핸들러에서 분리된 내부 함수.
 * 타이밍 정책(최소 응답 시간)은 POST에서 일괄 적용한다.
 */
async function resolveSignupResponse(request: NextRequest): Promise<Response> {
  const makeSignupSuccess = (email: string) =>
    successResponse(
      AUTH_API_CODES.SIGNUP_SUCCESS,
      {
        email,
        redirectTo: ROUTES.VERIFY_EMAIL,
      },
      { status: 200 },
    );

  /**
   * 요청 IP 추출 (rate limit key)
   */
  const ip = getClientIp(request);

  /**
   * IP 사전 검증 — 본문 파싱 비용 없이 IP 차단
   *
   * [이유: spec precheck_ip_rate_limit — must_run_before_body_parsing 요건]
   * - 읽기 전용: ipStore를 읽기만 함, 상태 변경 금지
   * - 최종 결정 권한이 아님: 이후 checkRequestEligibility가 최종 판단
   */
  const precheck = checkIpRateLimitPrecheck(ip);
  if (!precheck.allowed) {
    return failureResponse(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  }

  let body: unknown;
  try {
    body = await parseRequest(request);
  } catch (e) {
    /**
     * malformed JSON 처리
     */
    if (e instanceof JsonParseError) {
      return failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
        errors: [{ field: "body", reason: VALIDATION_REASON.INVALID_FORMAT }],
      });
    }
    throw e;
  }

  /**
   * 입력값 validation
   */
  const parsed = signupApiSchema.safeParse(body);

  if (!parsed.success) {
    return failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
      errors: mapSignupValidationErrors(parsed.error, body),
    });
  }

  const { email, password, nickname } = parsed.data;
  const canonicalEmail = canonicalizeEmail(email);

  /**
   * Request eligibility check — IP, email short, email long 에 대한 통합 판별
   *
   * 설계:
   * - single entry point: checkRequestEligibility 하나로 모든 조건 평가
   * - atomic: 판단과 상태 업데이트가 함수 내에서 함께 일어남
   * - AND evaluation: 세 조건(IP, short, long) 모두 통과해야 허용
   * - Observability: 차단 시에만 내부 로그 기록 (raw IP/email 노출 금지)
   */
  const eligibility = checkRequestEligibility("signup", ip, canonicalEmail);
  if (!eligibility.allowed) {
    return failureResponse(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  }

  /**
   * 기존 사용자 조회 (내부 분기용)
   *
   * ⚠️ 중요:
   * - 외부 응답은 반드시 동일해야 함
   */
  const existingUser = await getUserByEmail(canonicalEmail);

  /**
   * [기존 사용자 - 미인증]
   *
   * 이메일 재발송 시도 (side-effect)
   * ⚠️ 설계 의도:
   * - signup 정책은 magiclink 단일 타입을 사용한다.
   * - 링크 클릭 시 "이메일 인증"과 "로그인"을 한 번에 처리한다.
   */
  if (existingUser && existingUser.email_confirmed_at === null) {
    const deliveryEmail = existingUser.email;
    try {
      await issueAuthEmailLinkAndSend({
        type: "magiclink", // 로그인 인증 링크 생성
        email: deliveryEmail,
      });
    } catch {
      console.warn("이메일 재발송 실패 (무시됨)", { email: canonicalEmail });
    }

    return makeSignupSuccess(email);
  }

  /**
   * [기존 사용자 - 인증 완료]
   *
   * 미인증 사용자와 동일한 email link 흐름을 적용한다.
   * notify ticket 없이 magiclink로 통일한다.
   */
  if (existingUser && existingUser.email_confirmed_at !== null) {
    const deliveryEmail = existingUser.email;
    try {
      await issueAuthEmailLinkAndSend({
        type: "magiclink",
        email: deliveryEmail,
      });
    } catch {
      console.warn("인증 완료 사용자 이메일 발송 실패 (무시됨)", {
        email: canonicalEmail,
      });
    }

    return makeSignupSuccess(email);
  }

  /**
   * [신규 사용자 가입]
   *
   * 순서:
   * 1) createUser로 auth user 생성 보장
   * 2) magiclink 발급
   * 3) 커스텀 메일 발송
   *
   * 실패 정책:
   * - createUser/generateLink/tokenHash/sendAuthEmail 실패는 모두 외부에 노출하지 않는다.
   * - 내부 로깅만 남기고 동일한 SIGNUP_SUCCESS 계약을 유지한다.
   */
  const adminClient = createAdminClient();

  /**
   * NOTE:
   * email_confirm: false는 이메일 인증 상태만 제어하며,
   * Supabase의 자동 이메일 발송을 비활성화하는 옵션이 아니다.
   * 검증 기준(2026-04-14): 현재 운영/스테이징 설정에서는 Supabase 기본 이메일이
   * 발송되지 않아 커스텀 magiclink 메일만 발송되고 있다.
   *
   * ⚠️ 주의:
   * Supabase 이메일 설정(Auth Email Provider 포함)이 변경될 경우 기본 메일이 함께
   * 발송되어 중복 전송이 발생할 수 있으므로, 설정 전제를 유지해야 한다.
   * 설정 변경 시 signup 메일 발송 회귀 테스트를 반드시 수행한다.
   */
  const { error: createUserError } = await adminClient.auth.admin.createUser({
    email: email, // raw email — auth.users에 사용자 입력 보존
    password,
    email_confirm: false,
    user_metadata: { nickname, canonical_email: canonicalEmail }, // trigger가 profiles에 기록
  });

  if (createUserError) {
    console.error("Supabase admin.createUser failed", {
      email: email, // raw email 로깅
      message: createUserError.message,
      status: createUserError.status,
      code: createUserError.code,
      name: createUserError.name,
    });
    return makeSignupSuccess(email); // raw email 응답
  }

  const { data, error } = await adminClient.auth.admin.generateLink({
    email: email, // raw email — auth.users의 실제 email
    type: "magiclink",
    options: {
      data: { nickname },
    },
  });

  if (error) {
    console.error("Supabase generateLink(magiclink) failed", {
      email: email, // raw email 로깅
      message: error.message,
      status: error.status,
      code: error.code,
      name: error.name,
    });

    return makeSignupSuccess(email); // raw email 응답
  }

  const tokenHash = data.properties?.hashed_token;

  if (!tokenHash) {
    console.error("Supabase generateLink(magiclink) returned no hashed token", {
      email: email, // raw email 로깅
    });
    return makeSignupSuccess(email); // raw email 응답
  }

  try {
    await sendAuthEmail(email, tokenHash, "magiclink"); // raw email 발송
  } catch (error) {
    console.error("Failed to send signup magiclink email", {
      email: email, // raw email 로깅
      error,
    });
    // AE 방어: 이메일 발송 실패를 외부에 노출하지 않는다.
    // 계정은 이미 생성됨. 사용자는 재가입 시도 또는 /resend-verification-email로 재발송 가능.
  }

  /**
   * 최종 성공 응답 (완전 통일)
   */
  return makeSignupSuccess(email); // raw email 응답
}

/**
 * 회원가입 API (Account Enumeration 방어 적용)
 *
 * 핵심 원칙:
 * - 외부 응답은 항상 동일하게 유지
 * - 내부 상태 분기는 유지하되 외부로 노출하지 않음
 * - 응답만 보고 계정 존재 여부를 추론할 수 없도록 설계
 * - 모든 경로(성공/실패/예외)는 최소 응답 시간을 보장한다
 */
export async function POST(request: NextRequest) {
  const start = Date.now();
  let response: Response;

  try {
    response = await resolveSignupResponse(request);
  } catch {
    response = failureResponse(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
  }

  return applyMinimumResponseTime(start, response);
}
