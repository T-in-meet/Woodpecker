import { after, NextRequest } from "next/server";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { encryptTicket } from "@/features/auth/email/ticket";
import { applyMinimumResponseTime } from "@/features/auth/lib/applyMinimumResponseTime";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { failureResponse, successResponse } from "@/features/auth/lib/response";
import {
  checkSignupEmailRateLimit,
  checkSignupIpRateLimit,
  EMAIL_LIMIT,
  EMAIL_WINDOW_MS,
  IP_LIMIT,
  IP_WINDOW_MS,
} from "@/features/auth/signup/lib/checkSignupRateLimit";
import { logSignupRateLimitHit } from "@/features/auth/signup/lib/logSignupRateLimitHit";
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
  const uploadPath = `${crypto.randomUUID()}.${ext}`;

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
  /**
   * 요청 IP 추출 (rate limit key)
   */
  const ip = getClientIp(request);

  /**
   * IP rate limit은 가장 앞단에서 적용한다.
   *
   * 이유:
   * - malformed JSON / validation 실패 요청도 abuse 트래픽일 수 있다.
   * - 본문 파싱 이전에 차단해야 불필요한 서버 자원 소모를 줄일 수 있다.
   * - 따라서 signup에서는 "IP 선차단, email 후차단"의 단계형 정책을 사용한다.
   */
  const ipRateLimit = await checkSignupIpRateLimit(ip);
  if (!ipRateLimit.allowed) {
    logSignupRateLimitHit({
      dimension: "ip",
      route: "/api/auth/signup",
      limit: IP_LIMIT,
      windowMs: IP_WINDOW_MS,
      ip,
    });
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
   * Email rate limit은 validation 이후 정규화된 이메일 기준으로 적용한다.
   *
   * 이유:
   * - email key는 유효한 입력에서만 의미가 있다.
   * - 소문자 정규화 후 같은 계정을 동일한 버킷으로 취급해야 한다.
   */
  const emailRateLimit = await checkSignupEmailRateLimit(normalizedEmail);
  if (!emailRateLimit.allowed) {
    logSignupRateLimitHit({
      dimension: "email",
      route: "/api/auth/signup",
      limit: EMAIL_LIMIT,
      windowMs: EMAIL_WINDOW_MS,
      email: normalizedEmail,
    });
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
   * 이메일 재발송 시도 (side-effect):
   * - 실패해도 외부 응답은 항상 동일 (AE 방어)
   */
  if (existingUser && existingUser.email_confirmed_at === null) {
    try {
      const adminClient = createAdminClient();
      const { data: linkData, error: linkError } =
        await adminClient.auth.admin.generateLink({
          type: "magiclink", // 로그인 인증 링크 생성
          email: normalizedEmail,
        });

      if (!linkError && linkData?.properties?.hashed_token) {
        // callback에서 verifyOtp type을 결정할 수 있도록 ticket payload에 목적 prefix를 포함한다.
        const ticket = encryptTicket(
          `magiclink:${linkData.properties.hashed_token}`,
        );
        await sendAuthEmail(normalizedEmail, ticket, "verify-email");
      }
    } catch {
      console.warn("이메일 재발송 실패 (무시됨)", { email: normalizedEmail });
    }

    return successResponse(
      AUTH_API_CODES.SIGNUP_SUCCESS,
      {
        email: normalizedEmail,
        redirectTo: ROUTES.LOGIN,
      },
      { status: 200 },
    );
  }

  /**
   * [기존 사용자 - 인증 완료]
   */
  if (existingUser && existingUser.email_confirmed_at !== null) {
    try {
      // 기존 인증 사용자는 재인증이 목적이 아니므로, 인증정보 없는 notify marker ticket을 발급한다.
      const notifyTicket = encryptTicket(`notify-${crypto.randomUUID()}`);
      await sendAuthEmail(normalizedEmail, notifyTicket, "verify-email");
    } catch {
      console.warn("인증 완료 사용자 안내 메일 전송 실패 (무시됨)", {
        email: normalizedEmail,
      });
    }

    return successResponse(
      AUTH_API_CODES.SIGNUP_SUCCESS,
      {
        email: normalizedEmail,
        redirectTo: ROUTES.LOGIN,
      },
      { status: 200 },
    );
  }

  /**
   * [신규 사용자 가입]
   */
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.admin.generateLink({
    email: normalizedEmail,
    password,
    type: "signup",
    options: {
      /**
       * emailRedirectTo 제거 이유
       *
       * 기존:
       * - Supabase의 emailRedirectTo를 사용해 인증 링크 생성
       *
       * 변경:
       * - 인증 이메일은 Supabase 기본 링크를 사용하지 않고
       *   Send Email Hook → encryptTicket → sendAuthEmail 흐름으로 통일한다.
       *
       * 목적:
       * - 인증 링크 구조를 ticket 기반으로 일원화
       * - Supabase 기본 token 링크와의 혼재 방지
       * - Account Enumeration 방어를 위한 외부 흐름 통일
       *
       * 결과:
       * - signUp에서는 emailRedirectTo를 설정하지 않는다
       * - 이메일 발송은 Hook에서만 처리된다
       */

      data: { nickname },
    },
  });

  if (error) {
    console.error("Supabase generateLink(signup) failed", {
      email: normalizedEmail,
      message: error.message,
      status: error.status,
      code: error.code,
      name: error.name,
    });

    return failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
      status: 400,
    });
  }

  const tokenHash = data.properties?.hashed_token;

  if (!tokenHash) {
    console.error("Supabase generateLink(signup) returned no hashed token", {
      email: normalizedEmail,
    });
    return failureResponse(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
  }

  try {
    // 신규 가입 검증용 ticket임을 명시해 callback에서 signup verifyOtp로 분기한다.
    const ticket = encryptTicket(`signup:${tokenHash}`);
    await sendAuthEmail(normalizedEmail, ticket, "verify-email");
  } catch (error) {
    console.error("Failed to send signup verification email", {
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
  if (avatarFile && data.user) {
    const userId = data.user.id;
    after(() => uploadAvatar(adminClient, avatarFile, userId));
  }

  /**
   * 최종 성공 응답 (완전 통일)
   */
  return successResponse(
    AUTH_API_CODES.SIGNUP_SUCCESS,
    {
      email: data.user.email ?? normalizedEmail,
      redirectTo: ROUTES.LOGIN,
    },
    { status: 200 },
  );
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
