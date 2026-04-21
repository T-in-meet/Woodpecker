"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";

export function NotesNav() {
  const pathname = usePathname();
  const isNotesList =
    pathname === ROUTES.NOTES ||
    (pathname.startsWith("/notes") && pathname !== ROUTES.NOTES_NEW);

  return (
    <nav className="flex items-center gap-6">
      <Link
        href={ROUTES.NOTES}
        className={`text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm ${
          isNotesList
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        노트 목록
      </Link>
      <Link
        href={ROUTES.NOTES_NEW}
        className="text-base font-medium px-4 py-1.5 rounded-full cursor-pointer bg-[var(--color-orange-200)]/50 hover:bg-[var(--color-orange-200)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        + 새 노트
      </Link>
    </nav>
  );
}
