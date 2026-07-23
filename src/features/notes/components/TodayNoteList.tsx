"use client";

import { useNotesView } from "@/hooks/useNotesView";

import type { NoteSummary } from "../queries";
import type { NotesView } from "../utils/buildNotesUrl";
import { NoteGridCard } from "./NoteGridCard";
import { NoteListItem } from "./NoteListItem";
import { ViewToggle } from "./ViewToggle";

type TodayNoteListProps = {
  notes: NoteSummary[];
  initialView: NotesView;
  total: number;
};

export function TodayNoteList({
  notes,
  initialView,
  total,
}: TodayNoteListProps) {
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
        <p className="text-sm text-muted-foreground">총 {total}개</p>
        <ViewToggle view={view} onChange={updateView} />
      </div>

      {view === "cards" ? (
        <ul className="grid list-none grid-cols-2 gap-3 sm:grid-cols-3">
          {notes.map((note) => (
            <li key={note.id}>
              <NoteGridCard note={note} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex list-none flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id}>
              <NoteListItem note={note} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
