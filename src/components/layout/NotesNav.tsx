"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";

export function NotesNav() {
  const pathname = usePathname();
  const isNotesList =
    pathname.startsWith(ROUTES.NOTES) &&
    pathname !== ROUTES.NOTES_NEW &&
    pathname !== ROUTES.NOTES_TODAY;
  const isNotesNew = pathname === ROUTES.NOTES_NEW;
  const isNotesToday = pathname === ROUTES.NOTES_TODAY;

  return (
    <nav className="flex items-center gap-6 whitespace-nowrap">
      <Link
        href={ROUTES.NOTES}
        aria-current={isNotesList ? "page" : undefined}
        className={`text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm ${
          isNotesList
            ? "text-foreground font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        노트 목록
      </Link>
      <Link
        href={ROUTES.NOTES_TODAY}
        aria-current={isNotesToday ? "page" : undefined}
        className={`text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm flex items-center gap-1 ${
          isNotesToday
            ? "text-foreground font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        오늘의 복습
      </Link>
      <Link
        href={ROUTES.NOTES_NEW}
        aria-current={isNotesNew ? "page" : undefined}
        className={`text-base font-medium px-4 py-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center gap-1 ${
          isNotesNew
            ? "bg-orange-200 text-foreground font-semibold"
            : "bg-orange-200/50 hover:bg-orange-200"
        }`}
      >
        <Plus size={16} />새 노트
      </Link>
    </nav>
  );
}
