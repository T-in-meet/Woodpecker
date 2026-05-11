"use client";

import { AlignJustify, LayoutGrid } from "lucide-react";

import { useNotesView } from "@/hooks/useNotesView";
import { cn } from "@/lib/utils/cn";

import type { NoteSummary } from "../queries";
import type { NotesView } from "../utils/buildNotesUrl";
import { NoteCard } from "./NoteCard";
import { NoteCardCompact } from "./NoteCardCompact";

type TodayNoteListProps = {
  notes: NoteSummary[];
  initialView: NotesView;
};

export function TodayNoteList({ notes, initialView }: TodayNoteListProps) {
  const [view, updateView] = useNotesView(initialView);

  if (notes.length === 0) {
    return (
      <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        오늘 예정된 복습이 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">총 {notes.length}개</p>
        <div className="grid grid-cols-2 divide-x divide-input rounded-md border border-input">
          <button
            onClick={() => updateView("list")}
            aria-label="리스트 보기"
            className={cn(
              "flex cursor-pointer items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md",
              view === "list"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <AlignJustify className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </button>
          <button
            onClick={() => updateView("cards")}
            aria-label="카드 보기"
            className={cn(
              "flex cursor-pointer items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md",
              view === "cards"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Cards</span>
          </button>
        </div>
      </div>

      {view === "cards" ? (
        <ul className="grid list-none grid-cols-2 gap-3 sm:grid-cols-3">
          {notes.map((note) => (
            <li key={note.id}>
              <NoteCardCompact note={note} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex list-none flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id}>
              <NoteCard note={note} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
