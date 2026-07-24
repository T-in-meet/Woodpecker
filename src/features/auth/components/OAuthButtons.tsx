"use client";

import type { Provider } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/utils/showToast";

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

type OAuthButtonsProps = {
  intent: "login" | "signup";
  beforeSignIn?: () => boolean | Promise<boolean>;
  redirect?: string | null;
};

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

export function OAuthButtons({
  intent,
  beforeSignIn,
  redirect,
}: OAuthButtonsProps) {
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);

  const handleOAuthSignIn = async (provider: Provider) => {
    // 회원가입 화면에서는 약관 동의 여부를 확인한 뒤 OAuth redirect를 시작한다.
    if (beforeSignIn && !(await beforeSignIn())) {
      return;
    }

    setPendingProvider(provider);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: buildCallbackUrl(intent, redirect),
      },
    });

    if (error) {
      setPendingProvider(null);
      showToast(
        "소셜 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.",
        {
          variant: "destructive",
          dedupeKey: `auth-oauth-${provider}`,
        },
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-outline-variant" />
        <span className="text-xs text-muted-foreground">또는</span>
        <div className="h-px flex-1 bg-outline-variant" />
      </div>

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
    </div>
  );
}
