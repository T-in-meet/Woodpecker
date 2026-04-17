import { after, NextRequest } from "next/server";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { issueAuthEmailLinkAndSend } from "@/features/auth/email/issueAuthEmailLinkAndSend";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { applyMinimumResponseTime } from "@/features/auth/lib/applyMinimumResponseTime";
import {
  checkIpRateLimitPrecheck,
  checkRequestEligibility,
} from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { failureResponse, successResponse } from "@/features/auth/lib/response";
import { mapSignupValidationErrors } from "@/features/auth/signup/lib/mapSignupValidationErrors";
import { signupApiSchema } from "@/features/auth/signup/schema/signupApiSchema";
import {
  ALLOWED_AVATAR_EXTENSIONS,
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_SIZE_BYTES,
} from "@/lib/constants/profiles";
import { ROUTES } from "@/lib/constants/routes";
import { STORAGE_BUCKETS } from "@/lib/constants/storageBuckets";
import { createAdminClient } from "@/lib/supabase/admin";
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
 * - multipart/form-data와 JSON 요청을 모두 처리
 * - avatarFile을 별도로 분리하여 반환
 *
 * 보안 관점:
 * - 이 단계는 계정 상태와 무관한 입력 처리 단계
 * - 어떤 경우에도 계정 존재 여부와 연결되면 안됨
 */
async function parseRequest(
  request: NextRequest,
): Promise<{ body: unknown; avatarFile: File | null }> {
  const contentType = request.headers.get("content-type") ?? "";

  /**
   * multipart 요청 처리 (이미지 포함)
   */
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();

    /**
     * agreements는 JSON 문자열로 전달되므로 파싱 필요
     * 실패 시 null로 처리 (validation 단계에서 처리)
     */
    const agreementsRaw = formData.get("agreements");
    let agreements: unknown = null;

    try {
      agreements =
        typeof agreementsRaw === "string" ? JSON.parse(agreementsRaw) : null;
    } catch {
      agreements = null;
    }

    const body = {
      email: formData.get("email"),
      password: formData.get("password"),
      nickname: formData.get("nickname"),
      agreements,
    };

    /**
     * avatarFile은 File 타입인지 검증 후 추출
     */
    const imageEntry = formData.get("avatarFile");
    const avatarFile = imageEntry instanceof File ? imageEntry : null;

    return { body, avatarFile };
  }

  /**
   * JSON 요청 처리
   *
   * ⚠️ malformed JSON은 별도로 처리 필요
   */
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new JsonParseError();
  }

  return { body, avatarFile: null };
}

/**
 * 아바타 파일 유효성 검사
 *
 * 검증 항목:
 * - MIME 타입
 * - 확장자
 * - 파일 크기
 *
 * 목적:
 * - 잘못된 파일 업로드 방지
 * - 서버 리소스 보호
 */
function validateAvatarFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  return (
    ALLOWED_AVATAR_MIME_TYPES.includes(file.type) &&
    ALLOWED_AVATAR_EXTENSIONS.includes(ext) &&
    file.size <= MAX_AVATAR_SIZE_BYTES
  );
}

/**
 * 아바타 업로드 처리
 *
 * 흐름:
 * 1. 파일 검증
 * 2. Storage 업로드
 * 3. public URL 생성
 * 4. profiles 테이블 업데이트
 * 5. 실패 시 롤백
 *
 * 보안/설계 포인트:
 * - 업로드 실패는 회원가입 실패로 이어지지 않음
 * - 외부 응답에는 절대 영향을 주지 않음 (AE 방지)
 */
async function uploadAvatar(
  supabase: ReturnType<typeof createAdminClient>,
  avatarFile: File,
  userId: string,
): Promise<string | null> {
  if (!validateAvatarFile(avatarFile)) {
    console.warn("Invalid avatar file rejected");
    return null;
  }

  const ext = avatarFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const uploadPath = `${userId}/${crypto.randomUUID()}.${ext}`;

  /**
   * Storage 업로드
   */
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.AVATARS)
    .upload(uploadPath, avatarFile);

  if (uploadError || !uploadData) {
    console.error("Failed to upload avatar file", {
      userId,
      uploadError,
    });
    return null;
  }

  /**
   * public URL 생성
   */
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKETS.AVATARS)
    .getPublicUrl(uploadData.path);

  const avatarUrl = urlData.publicUrl;

  /**
   * profiles 테이블 업데이트
   */
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);

  /**
   * DB 업데이트 실패 시 롤백
   */
  if (updateError) {
    const { error: removeError } = await supabase.storage
      .from(STORAGE_BUCKETS.AVATARS)
      .remove([uploadData.path]);

    if (removeError) {
      console.error("Failed to rollback uploaded avatar file", {
        userId,
        path: uploadData.path,
        updateError,
        removeError,
      });
    } else {
      console.warn("Rolled back uploaded avatar file after DB update failure", {
        userId,
        path: uploadData.path,
        updateError,
      });
    }

    return null;
  }

  return avatarUrl;
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
  let avatarFile: File | null;

  try {
    ({ body, avatarFile } = await parseRequest(request));
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
  const normalizedEmail = email.toLowerCase();

  /**
   * Request eligibility check — IP, email short, email long 에 대한 통합 판별
   *
   * 설계:
   * - single entry point: checkRequestEligibility 하나로 모든 조건 평가
   * - atomic: 판단과 상태 업데이트가 함수 내에서 함께 일어남
   * - AND evaluation: 세 조건(IP, short, long) 모두 통과해야 허용
   * - Observability: 차단 시에만 내부 로그 기록 (raw IP/email 노출 금지)
   */
  const eligibility = checkRequestEligibility("signup", ip, normalizedEmail);
  if (!eligibility.allowed) {
    return failureResponse(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  }

  /**
   * 기존 사용자 조회 (내부 분기용)
   *
   * ⚠️ 중요:
   * - 외부 응답은 반드시 동일해야 함
   */
  const existingUser = await getUserByEmail(normalizedEmail);

  /**
   * [기존 사용자 - 미인증]
   *
   * 이메일 재발송 시도 (side-effect)
   * ⚠️ 설계 의도:
   * - signup 정책은 magiclink 단일 타입을 사용한다.
   * - 링크 클릭 시 "이메일 인증"과 "로그인"을 한 번에 처리한다.
   */
  if (existingUser && existingUser.email_confirmed_at === null) {
    try {
      await issueAuthEmailLinkAndSend({
        type: "magiclink", // 로그인 인증 링크 생성
        email: normalizedEmail,
      });
    } catch {
      console.warn("이메일 재발송 실패 (무시됨)", { email: normalizedEmail });
    }

    return makeSignupSuccess(normalizedEmail);
  }

  /**
   * [기존 사용자 - 인증 완료]
   *
   * 미인증 사용자와 동일한 email link 흐름을 적용한다.
   * notify ticket 없이 magiclink로 통일한다.
   */
  if (existingUser && existingUser.email_confirmed_at !== null) {
    try {
      await issueAuthEmailLinkAndSend({
        type: "magiclink",
        email: normalizedEmail,
      });
    } catch {
      console.warn("인증 완료 사용자 이메일 발송 실패 (무시됨)", {
        email: normalizedEmail,
      });
    }

    return makeSignupSuccess(normalizedEmail);
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
  const { data: createdData, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: false,
      user_metadata: { nickname },
    });

  if (createUserError) {
    console.error("Supabase admin.createUser failed", {
      email: normalizedEmail,
      message: createUserError.message,
      status: createUserError.status,
      code: createUserError.code,
      name: createUserError.name,
    });
    return makeSignupSuccess(normalizedEmail);
  }

  const signupUser = createdData.user;

  const { data, error } = await adminClient.auth.admin.generateLink({
    email: normalizedEmail,
    type: "magiclink",
    options: {
      data: { nickname },
    },
  });

  if (error) {
    console.error("Supabase generateLink(magiclink) failed", {
      email: normalizedEmail,
      message: error.message,
      status: error.status,
      code: error.code,
      name: error.name,
    });

    return makeSignupSuccess(normalizedEmail);
  }

  const tokenHash = data.properties?.hashed_token;

  if (!tokenHash) {
    console.error("Supabase generateLink(magiclink) returned no hashed token", {
      email: normalizedEmail,
    });
    return makeSignupSuccess(normalizedEmail);
  }

  const signupUserEmail = signupUser?.email ?? normalizedEmail;

  try {
    await sendAuthEmail(normalizedEmail, tokenHash, "magiclink");
  } catch (error) {
    console.error("Failed to send signup magiclink email", {
      email: normalizedEmail,
      error,
    });
    // AE 방어: 이메일 발송 실패를 외부에 노출하지 않는다.
    // 계정은 이미 생성됨. 사용자는 재가입 시도 또는 /resend-verification-email로 재발송 가능.
  }

  /**
   * 아바타 업로드 (side-effect)
   *
   * 응답 시간에서 upload latency를 제거하기 위해 after()로 응답 후 처리한다.
   * 실패해도 이미 응답이 전송된 이후이므로 외부 응답에 영향을 주지 않는다.
   */
  if (avatarFile && signupUser?.id) {
    const userId = signupUser.id;
    after(() => uploadAvatar(adminClient, avatarFile, userId));
  }

  /**
   * 최종 성공 응답 (완전 통일)
   */
  return makeSignupSuccess(signupUserEmail);
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
