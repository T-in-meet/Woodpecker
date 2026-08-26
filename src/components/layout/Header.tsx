import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AdminNotificationBell } from "@/features/admin/notifications/components/AdminNotificationBell";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { ROUTES } from "@/lib/constants/routes";
import { getProfile } from "@/lib/supabase/getProfile";
import { getUser } from "@/lib/supabase/getUser";

import { MobileMenu } from "./MobileMenu";
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
      {/* 가운데 열은 auto — 1fr 균등 분할 시 768~917px 구간에서 NotesNav가 줄바꿈됨 */}
      <div className="flex justify-between md:grid md:grid-cols-[1fr_auto_1fr] items-center max-w-5xl mx-auto px-6 py-3.5">
        <Link href={ROUTES.HOME} className="flex items-center gap-2">
          <Image src="/favicon.svg" alt="딱다구리" width={28} height={28} />
          {/* font-jeju: 브랜드 폰트(JejuStoneWall), globals.css @font-face 참조 */}
          <span className="font-jeju text-2xl">딱다구리</span>
        </Link>

        <div className="hidden md:flex justify-center">
          {profile && user && <NotesNav />}
        </div>

        <div className="flex items-center justify-end gap-1 md:gap-3">
          {profile && user ? (
            <>
              <NotificationBell userId={user.id} />
              {profile.role === "ADMIN" ? (
                <AdminNotificationBell adminUserId={user.id} />
              ) : null}
              <MobileMenu
                nickname={profile.nickname}
                email={user.email ?? ""}
                avatarUrl={profile.avatar_url}
                isAdmin={profile.role === "ADMIN"}
              />
              <div className="hidden md:block">
                <UserMenu
                  nickname={profile.nickname}
                  email={user.email ?? ""}
                  avatarUrl={profile.avatar_url}
                  isAdmin={profile.role === "ADMIN"}
                />
              </div>
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
      {/* 레이아웃 클래스는 Header와 동일하게 유지 — 로딩 → 렌더 전환 시 위치가 흔들리지 않도록 */}
      <div className="flex justify-between md:grid md:grid-cols-[1fr_auto_1fr] items-center max-w-5xl mx-auto px-6 py-3.5">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded bg-muted animate-pulse" />
          <div className="h-6 w-20 rounded bg-muted animate-pulse" />
        </div>
        <div />
        <div className="flex justify-end gap-3 items-center">
          <div className="h-9 w-16 rounded bg-muted animate-pulse" />
          <div className="h-9 w-20 rounded bg-muted animate-pulse" />
        </div>
      </div>
    </header>
  );
}
