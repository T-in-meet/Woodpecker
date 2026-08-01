"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export type ProfileNicknameNotice = "provider" | "fallback";

const PROFILE_NICKNAME_NOTICE_MESSAGES: Record<ProfileNicknameNotice, string> =
  {
    provider:
      "Google 계정 이름으로 닉네임이 설정되었습니다. 언제든 변경할 수 있습니다.",
    fallback:
      "기본 닉네임이 생성되었습니다. 프로필에서 원하는 닉네임으로 변경할 수 있습니다.",
  };

type DismissibleProfileNicknameNoticeProps = {
  notice?: ProfileNicknameNotice | null;
};

/**
 * OAuth 가입 직후 생성된 닉네임 정책 안내를 닫을 수 있는 형태로 표시합니다.
 */
export function DismissibleProfileNicknameNotice({
  notice = null,
}: DismissibleProfileNicknameNoticeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isVisible, setIsVisible] = useState(notice !== null);

  if (!notice || !isVisible) return null;

  const message = PROFILE_NICKNAME_NOTICE_MESSAGES[notice];

  /**
   * 안내를 현재 화면에서 숨기고 URL query에서도 제거합니다.
   */
  const handleDismiss = () => {
    setIsVisible(false);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("profile_nickname");

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  };

  return (
    <div className="mb-4 flex items-start gap-3 rounded-md border border-outline-variant bg-destructive px-3 py-2 text-sm text-muted-foreground">
      <p className="min-w-0 flex-1">{message}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="닉네임 안내 닫기"
        className="-mr-1 -mt-1 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
