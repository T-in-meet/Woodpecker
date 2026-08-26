import type { NoteSummary } from "../queries";
import { NoteListItem } from "./NoteListItem";

type TodayNoteListProps = {
  notes: NoteSummary[];
  total: number;
};

export function TodayNoteList({ notes, total }: TodayNoteListProps) {
  if (notes.length === 0) {
    return (
      <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        오늘 예정된 복습이 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">총 {total}개</p>

      <ul className="flex list-none flex-col gap-3">
        {notes.map((note) => (
          <li key={note.id}>
            <NoteListItem note={note} />
          </li>
        ))}
      </ul>
    </div>
  );
}
