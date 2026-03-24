"use client";

import { LogOut, Settings, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { logoutAction } from "@/features/mypage/actions";
import { ROUTES } from "@/lib/constants/routes";

type UserMenuProps = {
  nickname: string;
  email: string;
  avatarUrl: string | null;
};

export function UserMenu({ nickname, email, avatarUrl }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-accent cursor-pointer"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={nickname}
              width={32}
              height={32}
              className="rounded-full object-cover"
            />
          ) : (
            nickname.charAt(0)
          )}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border bg-background shadow-lg">
          {/* 유저 정보 */}
          <div className="px-4 py-3">
            <p className="text-sm font-medium">{nickname}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>

          <div className="border-t" />

          {/* 메뉴 항목 */}
          <div className="py-1">
            <Link
              href={ROUTES.MYPAGE}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-accent"
            >
              <User className="size-4" />
              마이페이지
            </Link>
            {/* <Link
              href={`${ROUTES.MYPAGE}?section=account`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-accent"
            >
              <Settings className="size-4" />
              계정 설정
            </Link> */}
          </div>

          <div className="border-t" />

          {/* 로그아웃 */}
          <div className="py-1">
            <button
              onClick={() => {
                setOpen(false);
                startTransition(async () => {
                  await logoutAction();
                });
              }}
              disabled={isPending}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive transition-colors hover:bg-accent disabled:opacity-50"
            >
              <LogOut className="size-4" />
              {isPending ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
