"use client";

import { MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isCurrentNavRoute, ROUTES } from "@/lib/constants/routes";

export function NotesNav() {
  const pathname = usePathname();

  const isNoteChats = isCurrentNavRoute(pathname, ROUTES.NOTE_CHATS);
  const isNotesList = isCurrentNavRoute(pathname, ROUTES.NOTES);
  const isNotesNew = isCurrentNavRoute(pathname, ROUTES.NOTES_NEW);

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

      <Link
        href={ROUTES.NOTE_CHATS}
        aria-current={isNoteChats ? "page" : undefined}
        className={`flex items-center gap-1 rounded-sm text-base font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
          isNoteChats
            ? "font-semibold text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <MessageCircle className="size-4" />
        노트 챗봇
      </Link>
    </nav>
  );
}
