import { NextRequest } from "next/server";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { applyMinimumResponseTime } from "@/features/auth/lib/applyMinimumResponseTime";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { failureResponse, successResponse } from "@/features/auth/lib/response";
import { checkSignupRateLimit } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { mapSignupValidationErrors } from "@/features/auth/signup/lib/mapSignupValidationErrors";
import { signupApiSchema } from "@/features/auth/signup/schema/signupApiSchema";
import {
  ALLOWED_AVATAR_EXTENSIONS,
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_SIZE_BYTES,
} from "@/lib/constants/profiles";
import { ROUTES } from "@/lib/constants/routes";
import { STORAGE_BUCKETS } from "@/lib/constants/storageBuckets";
import { createClient } from "@/lib/supabase/server";
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
  supabase: Awaited<ReturnType<typeof createClient>>,
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
   * rate limit 체크
   */
  const rateLimit = await checkSignupRateLimit(ip, normalizedEmail);
  if (!rateLimit.allowed) {
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
   */
  if (existingUser && existingUser.email_confirmed_at === null) {
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
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      /**
       * emailRedirectTo는 "API 호출 URL"이 아니라
       * "사용자가 이메일 클릭 시 브라우저가 최초로 이동하는 URL"이다.
       *
       * ⚠️ 중요한 개념:
       * - NEXT_PUBLIC_APP_URL = 프론트 도메인 (브라우저가 접근하는 주소)
       * - /auth/callback = Next.js route handler (API 역할 수행)
       *
       * 즉, 이 URL은:
       * - 사용자 입장에서는 "페이지 이동"
       * - 내부적으로는 route.ts가 실행되는 "서버 처리 지점"
       *
       * 흐름:
       * 이메일 클릭 → /auth/callback (route.ts 실행)
       * → 인증 처리 (verifyOtp 등)
       * → /login으로 redirect
       *
       * 따라서 "프론트 도메인 + API route 경로" 조합은 정상이며 의도된 구조이다.
       */
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}${ROUTES.CALLBACK}`,
      data: { nickname },
    },
  });

  if (error) {
    return failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
      status: 400,
    });
  }

  let avatarUrl: string | null = null;

  /**
   * 아바타 업로드 (side-effect)
   */
  if (avatarFile && data.user) {
    avatarUrl = await uploadAvatar(supabase, avatarFile, data.user.id);
  }

  /**
   * 최종 성공 응답 (완전 통일)
   */
  return successResponse(
    AUTH_API_CODES.SIGNUP_SUCCESS,
    {
      email: data.user?.email ?? normalizedEmail,
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
