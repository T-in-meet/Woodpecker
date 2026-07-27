import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { ROUTES } from "@/lib/constants/routes";
import { getProfile } from "@/lib/supabase/getProfile";
import { getUser } from "@/lib/supabase/getUser";

import { NotesNav } from "./NotesNav";
import { UserMenu } from "./UserMenu";

export async function Header() {
  let user = null;
  let profile = null;

  try {
    // getProfile()은 React.cache()로 래핑되어 있어
    // 동일 요청 내 Header와 page 컴포넌트 간 중복 쿼리가 방지됨
    [user, profile] = await Promise.all([getUser(), getProfile()]);
  } catch {
    // 환경변수 미설정 등으로 Supabase 연결 실패 시 비로그인 상태로 fallback
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="flex justify-between md:grid md:grid-cols-3 items-center max-w-5xl mx-auto px-6 py-3.5">
        <Link href={ROUTES.HOME} className="flex items-center gap-2">
          <Image src="/favicon.svg" alt="딱다구리" width={28} height={28} />
          {/* font-jeju: 브랜드 폰트(JejuStoneWall), globals.css @font-face 참조 */}
          <span className="font-jeju text-2xl">딱다구리</span>
        </Link>

        <div className="hidden md:flex justify-center">
          {profile && user && <NotesNav />}
        </div>

        <div className="flex justify-end gap-3 items-center">
          {profile && user ? (
            <>
              <NotificationBell userId={user.id} />
              <UserMenu
                nickname={profile.nickname}
                email={user.email ?? ""}
                avatarUrl={profile.avatar_url}
                isAdmin={profile.role === "ADMIN"}
              />
            </>
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

export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="grid grid-cols-3 items-center max-w-5xl mx-auto px-6 py-3.5">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded bg-muted animate-pulse" />
          <div className="h-6 w-20 rounded bg-muted animate-pulse" />
        </div>
        <div />
        <div className="flex justify-end gap-3">
          <div className="h-9 w-16 rounded bg-muted animate-pulse" />
          <div className="h-9 w-20 rounded bg-muted animate-pulse" />
        </div>
      </div>
    </header>
  );
}
