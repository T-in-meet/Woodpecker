import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profiles.types";

import { UserMenu } from "./UserMenu";

// TODO: 렌더링 확인용 mock — 확인 후 제거
const MOCK_USER_EMAIL = "test@woodpecker.com";
const MOCK_PROFILE: Profile = {
  id: "00000000-0000-0000-0000-000000000000",
  nickname: "딱다구리",
  avatar_url: null,
  role: "USER",
  created_at: "2025-01-15T09:00:00Z",
  updated_at: "2025-03-20T12:00:00Z",
};

export async function Header() {
  // TODO: 렌더링 확인용 mock — 확인 후 아래 블록으로 교체
  // const supabase = await createClient();
  // const {
  //   data: { user },
  // } = await supabase.auth.getUser();
  // let profile: Profile | null = null;
  // if (user) {
  //   const { data } = await supabase
  //     .from("profiles")
  //     .select("*")
  //     .eq("id", user.id)
  //     .single();
  //   profile = data as Profile | null;
  // }
  const user = { email: MOCK_USER_EMAIL };
  const profile = MOCK_PROFILE;

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="flex items-center justify-between max-w-5xl mx-auto px-6 py-3.5">
        <Link href={ROUTES.HOME} className="flex items-center gap-2">
          <Image src="/favicon.svg" alt="딱다구리" width={28} height={28} />
          <span className="font-jeju text-2xl">딱다구리</span>
        </Link>

        <div className="flex gap-3">
          {profile && user ? (
            <UserMenu
              nickname={profile.nickname}
              email={user.email ?? ""}
              avatarUrl={profile.avatar_url}
            />
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href={ROUTES.LOGIN}>로그인</Link>
              </Button>
              <Button asChild>
                <Link href={ROUTES.SIGNUP}>회원가입</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
