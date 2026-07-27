import { BarChart2, ListTodo, User } from "lucide-react";
import Link from "next/link";

import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

export type MypageSection = "profile" | "stats" | "reviews";

const navItems = [
  { id: "stats" as const, label: "학습 통계", icon: BarChart2 },
  { id: "reviews" as const, label: "복습 대기", icon: ListTodo },
  { id: "profile" as const, label: "계정 관리", icon: User },
];

type MypageNavProps = {
  activeSection: MypageSection;
};

export function MypageNav({ activeSection }: MypageNavProps) {
  return (
    <>
      {/* 데스크탑: 세로 목록 */}
      <nav className="hidden w-48 flex-col gap-1 md:flex">
        {navItems.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`${ROUTES.MYPAGE}?section=${id}`}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              activeSection === id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>

      {/* 모바일: 가로 탭 */}
      <nav className="flex border-b md:hidden">
        {navItems.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`${ROUTES.MYPAGE}?section=${id}`}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
              activeSection === id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
