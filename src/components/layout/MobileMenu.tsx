"use client";

import {
  BookOpen,
  LogOut,
  type LucideIcon,
  Menu as MenuIcon,
  MessageCircle,
  PenLine,
  Shield,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { logoutAction } from "@/features/mypage/actions";
import { isCurrentNavRoute, ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

type MobileMenuProps = {
  nickname: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

type MobileNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// 아이콘은 모든 항목이 갖는다. 일부만 비면 라벨 시작 위치가 어긋나 왼쪽 정렬이 깨진다.
const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { href: ROUTES.NOTES, label: "노트 목록", icon: BookOpen },
  { href: ROUTES.NOTES_NEW, label: "노트 작성", icon: PenLine },
  { href: ROUTES.NOTE_CHATS, label: "노트 챗봇", icon: MessageCircle },
];

export function MobileMenu({
  nickname,
  email,
  avatarUrl,
  isAdmin,
}: MobileMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="size-11 md:hidden"
          aria-label="메뉴 열기"
        >
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent className="w-[min(20rem,calc(100vw-2rem))] gap-0 p-0 md:hidden">
        <SheetHeader className="border-b p-5 pr-12">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  width={44}
                  height={44}
                  className="size-11 rounded-full object-cover"
                />
              ) : (
                nickname.charAt(0)
              )}
            </div>
            <div className="min-w-0 text-left">
              <SheetTitle className="truncate">{nickname}</SheetTitle>
              <SheetDescription className="truncate text-xs">
                {email}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <nav aria-label="모바일 주 메뉴" className="flex-1 overflow-y-auto p-3">
          <p className="px-3 pb-2 pt-1 text-xs font-medium text-muted-foreground">
            학습
          </p>
          <div className="space-y-1">
            {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isCurrent = isCurrentNavRoute(pathname, href);

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isCurrent
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <SheetFooter className="gap-1 border-t p-3">
          <Link
            href={ROUTES.MYPAGE}
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <User className="size-4" />
            마이페이지
          </Link>
          {isAdmin ? (
            <Link
              href={ROUTES.ADMIN.DASHBOARD}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Shield className="size-4" />
              관리자 페이지
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              startTransition(async () => {
                await logoutAction();
              });
            }}
            disabled={isPending}
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut className="size-4" />
            {isPending ? "로그아웃 중..." : "로그아웃"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
