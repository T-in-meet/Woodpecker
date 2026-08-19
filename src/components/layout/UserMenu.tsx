"use client";

import {
  BookOpen,
  CalendarCheck,
  LogOut,
  MessageCircle,
  Plus,
  Shield,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { logoutAction } from "@/features/mypage/actions";
import { ROUTES } from "@/lib/constants/routes";

type UserMenuProps = {
  nickname: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

export function UserMenu({
  nickname,
  email,
  avatarUrl,
  isAdmin,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 드롭다운이 열렸을 때만 리스너 등록 — 닫혀 있을 때 전역 리스너 불필요
    if (!open) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full p-px transition-colors hover:bg-accent cursor-pointer"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={nickname}
              width={40}
              height={40}
              className="size-10 rounded-full object-cover"
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

          {/* 노트 메뉴 — 모바일에서만 표시 */}
          <div className="py-1 md:hidden">
            <Link
              href={ROUTES.NOTES}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-accent"
            >
              <BookOpen className="size-4" />
              노트 목록
            </Link>
            <Link
              href={ROUTES.NOTES_TODAY}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-accent"
            >
              <CalendarCheck className="size-4" />
              오늘의 복습
            </Link>
            <Link
              href={ROUTES.NOTES_NEW}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-accent"
            >
              <Plus className="size-4" />새 노트
            </Link>

            <Link
              href={ROUTES.NOTE_CHATS}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-accent"
            >
              <MessageCircle className="size-4" />
              노트 챗봇
            </Link>
          </div>

          <div className="border-t md:hidden" />

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

            {/* 관리자 페이지 */}
            {isAdmin && (
              <Link
                href={ROUTES.ADMIN.DASHBOARD}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-accent"
              >
                <Shield className="size-4" />
                관리자 페이지
              </Link>
            )}
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
