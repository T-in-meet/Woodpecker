import type { User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import {
  OAUTH_CALLBACK_ERROR_PARAM,
  OAUTH_CALLBACK_ERROR_REASON,
} from "@/features/auth/constants/oauthCallbackError";
import {
  clearOAuthAgreementIntentCookie,
  hasOAuthAgreementIntentCookie,
} from "@/features/auth/lib/oauthAgreementIntent";
import {
  AGREEMENT_REQUIRED_REDIRECT,
  ensureUserAgreement,
  hasUserAgreement,
} from "@/features/auth/lib/userAgreements";
import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";
import { NICKNAME_MAX_LENGTH } from "@/lib/constants/profiles";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const OAUTH_NICKNAME_NOTICE_PARAM = "profile_nickname";
const OAUTH_NICKNAME_NOTICE = {
  provider: "provider",
  fallback: "fallback",
} as const;

type OAuthNicknameNotice =
  (typeof OAUTH_NICKNAME_NOTICE)[keyof typeof OAUTH_NICKNAME_NOTICE];

/**
 * OAuth provider가 제공한 이메일을 프로필 canonical email로 변환합니다.
 *
 * @param user OAuth callback에서 세션 교환으로 받은 Supabase 사용자
 * @returns 정규화 가능한 이메일이 있으면 canonical email, 없으면 null
 */
function getOAuthCanonicalEmail(user: User): string | null {
  const email = user.email?.trim();

  return email ? canonicalizeEmail(email) : null;
}

/**
 * OAuth 사용자 프로필에 관리자 목록 검색용 canonical email을 저장합니다.
 *
 * 이메일 가입은 createUser metadata를 통해 trigger에서 canonical_email이 기록되지만,
 * OAuth 가입은 provider callback에서만 이메일을 확인할 수 있어 별도로 동기화합니다.
 *
 * @param user OAuth callback에서 세션 교환으로 받은 Supabase 사용자
 */
async function syncOAuthCanonicalEmailToProfile(user: User): Promise<void> {
  const canonicalEmail = getOAuthCanonicalEmail(user);
  if (!canonicalEmail) return;

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({ canonical_email: canonicalEmail })
    .eq("id", user.id);

  if (error) {
    throw error;
  }
}

/**
 * OAuth 이메일 동기화를 시도하되 인증 callback 성공 흐름은 유지합니다.
 *
 * @param user OAuth callback에서 세션 교환으로 받은 Supabase 사용자
 */
async function trySyncOAuthCanonicalEmailToProfile(user: User): Promise<void> {
  try {
    await syncOAuthCanonicalEmailToProfile(user);
  } catch (error) {
    console.warn("[auth callback] OAuth canonical email sync failed", {
      error,
      userId: user.id,
    });
  }
}

/**
 * OAuth provider metadata에서 nickname 후보 문자열을 정규화합니다.
 *
 * @param value provider metadata 후보 값
 * @returns 프로젝트 nickname 제약을 만족하면 정규화된 문자열, 아니면 null
 */
function normalizeOAuthNicknameCandidate(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const candidate = value.trim();
  if (candidate.length < 1 || candidate.length > NICKNAME_MAX_LENGTH) {
    return null;
  }

  return candidate;
}

/**
 * OAuth provider metadata 기준 닉네임 후보를 계산합니다.
 *
 * DB trigger와 동일하게 nickname → name → full_name 순서로 유효한 값을 선택합니다.
 *
 * @param user OAuth callback에서 세션 교환으로 받은 Supabase 사용자
 * @returns 유효한 provider nickname 후보가 있으면 문자열, 없으면 null
 */
function getOAuthProviderNicknameCandidate(user: User): string | null {
  return (
    normalizeOAuthNicknameCandidate(user.user_metadata["nickname"]) ??
    normalizeOAuthNicknameCandidate(user.user_metadata["name"]) ??
    normalizeOAuthNicknameCandidate(user.user_metadata["full_name"])
  );
}

/**
 * profile nickname이 DB fallback 패턴인지 확인합니다.
 *
 * @param userId Supabase auth user id
 * @param nickname profiles.nickname 값
 * @returns 현재 trigger fallback 값과 일치하면 true
 */
function isFallbackNickname(userId: string, nickname: string): boolean {
  return nickname === `user_${userId.slice(0, 5)}`;
}

/**
 * OAuth 가입 완료 후 보여줄 nickname 안내 종류를 결정합니다.
 *
 * @param user OAuth callback에서 세션 교환으로 받은 Supabase 사용자
 * @returns provider 이름 사용 또는 fallback 사용 안내가 필요하면 notice 값, 아니면 null
 */
async function getOAuthNicknameNotice(
  user: User,
): Promise<OAuthNicknameNotice | null> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();

  if (error || !data || typeof data.nickname !== "string") {
    if (error) {
      console.warn("[auth callback] OAuth nickname notice lookup failed", {
        error,
        userId: user.id,
      });
    }
    return null;
  }

  const providerNickname = getOAuthProviderNicknameCandidate(user);
  if (providerNickname && data.nickname === providerNickname) {
    return OAUTH_NICKNAME_NOTICE.provider;
  }

  if (isFallbackNickname(user.id, data.nickname)) {
    return OAUTH_NICKNAME_NOTICE.fallback;
  }

  return null;
}

/**
 * OAuth nickname 안내가 필요한 경우 redirect URL에 query를 추가합니다.
 *
 * @param url 기본 redirect URL
 * @param notice nickname 안내 종류
 * @returns query가 반영된 redirect URL
 */
function addOAuthNicknameNotice(url: URL, notice: OAuthNicknameNotice | null) {
  if (!notice || url.pathname !== ROUTES.MYPAGE) return url;

  url.searchParams.set("section", "profile");
  url.searchParams.set(OAUTH_NICKNAME_NOTICE_PARAM, notice);

  return url;
}

/**
 * OAuth provider metadata에서 프로필 이미지 URL을 추출합니다.
 *
 * @param user OAuth callback에서 세션 교환으로 받은 Supabase 사용자
 * @returns 유효한 이미지 URL이 있으면 URL, 없으면 null
 */
function getOAuthAvatarUrl(user: User): string | null {
  const avatarUrl =
    user.user_metadata["avatar_url"] ?? user.user_metadata["picture"];

  return typeof avatarUrl === "string" && avatarUrl.length > 0
    ? avatarUrl
    : null;
}

/**
 * 이미지 content-type에 맞는 저장 확장자를 반환합니다.
 *
 * @param contentType OAuth provider 이미지 응답의 content-type
 * @returns Supabase Storage에 저장할 파일 확장자
 */
function getImageExtension(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";

  return "jpg";
}

/**
 * OAuth provider의 프로필 이미지를 Supabase Storage로 복사합니다.
 *
 * @param user OAuth callback에서 세션 교환으로 받은 Supabase 사용자
 */
async function importOAuthAvatarToStorage(user: User): Promise<void> {
  const avatarUrl = getOAuthAvatarUrl(user);
  if (!avatarUrl) return;

  const response = await fetch(avatarUrl);
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok || !contentType.startsWith("image/")) {
    return;
  }

  const adminClient = createAdminClient();
  const extension = getImageExtension(contentType);
  const avatarPath = `${user.id}/oauth-avatar.${extension}`;
  const avatarFile = await response.blob();

  const { error: uploadError } = await adminClient.storage
    .from("avatars")
    .upload(avatarPath, avatarFile, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = adminClient.storage.from("avatars").getPublicUrl(avatarPath);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (profileError) {
    throw profileError;
  }
}

/**
 * OAuth 의도 쿠키를 제거하면서 지정한 URL로 redirect합니다.
 *
 * @param url redirect할 대상 URL
 * @returns OAuth 의도 쿠키 삭제가 반영된 redirect 응답
 */
function redirectWithClearedIntent(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  clearOAuthAgreementIntentCookie(response);

  return response;
}

/**
 * OAuth callback 실패 시 의도에 맞는 오류 redirect URL을 생성합니다.
 *
 * @param origin 요청 origin
 * @param intent OAuth 시작 의도
 * @param reason callback 실패 사유
 * @returns OAuth 오류 query가 포함된 redirect URL
 */
function buildOAuthErrorUrl(
  origin: string,
  intent: string | null,
  reason: string,
): URL {
  const url = new URL(
    intent === "signup" ? ROUTES.SIGNUP : ROUTES.LOGIN,
    origin,
  );
  url.searchParams.set(OAUTH_CALLBACK_ERROR_PARAM, reason);

  return url;
}

/**
 * Supabase Auth Callback Route
 *
 * 현재 역할:
 * - OAuth callback 처리 전용
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const intent = requestUrl.searchParams.get("intent");
  const hasSignupAgreementIntent = hasOAuthAgreementIntentCookie(request);
  const effectiveIntent =
    intent ?? (hasSignupAgreementIntent ? "signup" : null);
  const redirectPath = validateRedirectPath(
    requestUrl.searchParams.get("redirect") ?? ROUTES.MYPAGE,
  );

  if (!code) {
    console.warn("[auth callback] missing OAuth code", {
      intent,
      effectiveIntent,
      hasSignupAgreementIntent,
    });

    return NextResponse.redirect(
      buildOAuthErrorUrl(
        requestUrl.origin,
        effectiveIntent,
        OAUTH_CALLBACK_ERROR_REASON.MISSING_CODE,
      ),
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.warn("[auth callback] OAuth code exchange failed", {
      intent,
      effectiveIntent,
      hasSignupAgreementIntent,
      errorMessage: error?.message,
    });

    return redirectWithClearedIntent(
      buildOAuthErrorUrl(
        requestUrl.origin,
        effectiveIntent,
        OAUTH_CALLBACK_ERROR_REASON.EXCHANGE_FAILED,
      ),
    );
  }

  if (effectiveIntent === "signup") {
    if (!hasSignupAgreementIntent) {
      await supabase.auth.signOut();
      return redirectWithClearedIntent(
        new URL(AGREEMENT_REQUIRED_REDIRECT, requestUrl.origin),
      );
    }

    await ensureUserAgreement(data.user.id, "oauth");
    await trySyncOAuthCanonicalEmailToProfile(data.user);

    try {
      // Google 프로필 이미지는 외부 CDN 직접 의존 대신 Supabase Storage에 복사한다.
      await importOAuthAvatarToStorage(data.user);
    } catch {
      // 아바타 동기화 실패가 인증 성공 흐름을 막지 않도록 한다.
    }

    const nicknameNotice = await getOAuthNicknameNotice(data.user);

    return redirectWithClearedIntent(
      addOAuthNicknameNotice(
        new URL(redirectPath, requestUrl.origin),
        nicknameNotice,
      ),
    );
  }

  const hasAgreement = await hasUserAgreement(data.user.id);
  if (!hasAgreement) {
    await supabase.auth.signOut();
    return redirectWithClearedIntent(
      new URL(AGREEMENT_REQUIRED_REDIRECT, requestUrl.origin),
    );
  }

  await trySyncOAuthCanonicalEmailToProfile(data.user);

  return redirectWithClearedIntent(new URL(redirectPath, requestUrl.origin));
}
