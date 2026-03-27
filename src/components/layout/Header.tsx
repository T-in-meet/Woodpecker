import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";
import { getUser } from "@/lib/supabase/getUser";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profiles.types";

import { UserMenu } from "./UserMenu";

export async function Header() {
  let user = null;
  let profile: Profile | null = null;

  try {
    const [currentUser, supabase] = await Promise.all([
      getUser(),
      createClient(),
    ]);
    user = currentUser;

    if (user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      profile = profileData as Profile | null;
    }
  } catch {
    // 환경변수 미설정 등으로 Supabase 연결 실패 시 비로그인 상태로 fallback
  }

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
