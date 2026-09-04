"use client";

import type { Provider } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

import AuthenticationError from "./AuthenticationError";

type OAuthProviderConfig = {
  provider: Provider;
  label: string;
  logoSrc: string;
};

const OAUTH_PROVIDERS: OAuthProviderConfig[] = [
  // provider별 로고 파일명을 config에 묶어 버튼 렌더링 분기를 단순하게 유지한다.
  {
    provider: "google",
    label: "Google",
    logoSrc: "/images/logos/google.webp",
  },
];

/**
 * OAuth 시작 전 사전 검사 결과.
 *
 * message가 없는 실패는 "호출자가 이미 다른 자리(예: 체크박스 옆 필드 오류)에
 * 표시했으니 여기서는 중단만 하라"는 뜻이다. 같은 내용을 버튼 아래에 한 번 더
 * 띄우면 사용자가 오류 두 개로 읽는다.
 */
export type OAuthBeforeSignInResult =
  | { ok: true }
  | { ok: false; message?: string };

type OAuthButtonsProps = {
  intent: "login" | "signup";
  beforeSignIn?: () =>
    | OAuthBeforeSignInResult
    | Promise<OAuthBeforeSignInResult>;
  redirect?: string | null;
  showSeparator?: boolean;
};

/**
 * OAuth callback URL을 생성한다.
 */
function buildCallbackUrl(
  intent: OAuthButtonsProps["intent"],
  redirect?: string | null,
) {
  // Supabase OAuth code는 앱 callback route에서 session cookie로 교환한다.
  const callbackUrl = new URL("/api/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("intent", intent);

  if (redirect) {
    callbackUrl.searchParams.set("redirect", redirect);
  }

  return callbackUrl.toString();
}

/**
 * OAuth provider 버튼 목록을 렌더링한다.
 */
export function OAuthButtons({
  intent,
  beforeSignIn,
  redirect,
  showSeparator = true,
}: OAuthButtonsProps) {
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  // 재시도가 필요한 오류라 사라지는 toast 대신 버튼 아래에 남긴다.
  const [error, setError] = useState<string | null>(null);

  /**
   * 선택한 OAuth provider로 로그인 또는 회원가입을 시작한다.
   */
  const handleOAuthSignIn = async (provider: Provider) => {
    // 이전 시도의 오류가 남아 있으면 재시도 결과와 섞여 보인다.
    setError(null);

    // 회원가입 화면에서는 약관 동의 여부를 확인한 뒤 OAuth redirect를 시작한다.
    if (beforeSignIn) {
      const result = await beforeSignIn();

      if (!result.ok) {
        if (result.message) {
          setError(result.message);
        }

        return;
      }
    }

    setPendingProvider(provider);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: buildCallbackUrl(intent, redirect),
      },
    });

    if (signInError) {
      setPendingProvider(null);
      setError("소셜 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  return (
    <div className="space-y-4">
      {showSeparator && (
        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-outline-variant" />
          <span className="text-xs text-muted-foreground">또는</span>
          <div className="h-px flex-1 bg-outline-variant" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {OAUTH_PROVIDERS.map(({ provider, label, logoSrc }) => {
          const isPending = pendingProvider === provider;

          return (
            <Button
              key={provider}
              type="button"
              variant="outline"
              disabled={pendingProvider !== null}
              className="w-full"
              onClick={() => void handleOAuthSignIn(provider)}
            >
              {isPending && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {/* 장식 로고이므로 버튼의 접근 가능한 이름은 텍스트만 사용한다. */}
              {!isPending && (
                <Image
                  src={logoSrc}
                  alt=""
                  width={18}
                  height={18}
                  aria-hidden="true"
                  className="mr-2 h-[1.125em] w-[1.125em] object-contain"
                />
              )}
              {label} 계정으로 계속하기
            </Button>
          );
        })}
      </div>

      <AuthenticationError error={error ? { message: error } : undefined} />
    </div>
  );
}
