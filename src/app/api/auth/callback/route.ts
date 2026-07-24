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
  hasUserAgreement,
  upsertUserAgreement,
} from "@/features/auth/lib/userAgreements";
import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function getOAuthAvatarUrl(user: User): string | null {
  const avatarUrl =
    user.user_metadata["avatar_url"] ?? user.user_metadata["picture"];

  return typeof avatarUrl === "string" && avatarUrl.length > 0
    ? avatarUrl
    : null;
}

function getImageExtension(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";

  return "jpg";
}

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

function redirectWithClearedIntent(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  clearOAuthAgreementIntentCookie(response);

  return response;
}

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

    await upsertUserAgreement(data.user.id, "oauth");

    try {
      // Google 프로필 이미지는 외부 CDN 직접 의존 대신 Supabase Storage에 복사한다.
      await importOAuthAvatarToStorage(data.user);
    } catch {
      // 아바타 동기화 실패가 인증 성공 흐름을 막지 않도록 한다.
    }

    return redirectWithClearedIntent(new URL(redirectPath, requestUrl.origin));
  }

  const hasAgreement = await hasUserAgreement(data.user.id);
  if (!hasAgreement) {
    await supabase.auth.signOut();
    return redirectWithClearedIntent(
      new URL(AGREEMENT_REQUIRED_REDIRECT, requestUrl.origin),
    );
  }

  return redirectWithClearedIntent(new URL(redirectPath, requestUrl.origin));
}
