import type { NoteSummary } from "../queries";
import { NoteCard } from "./NoteCard";

type NoteListProps = {
  notes: NoteSummary[];
};

export function NoteList({ notes }: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
        <p className="text-base font-medium text-foreground">
          아직 저장한 노트가 없습니다.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          첫 노트를 작성하고 복습 흐름을 시작해보세요.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {notes.map((note) => (
        <li key={note.id} className="list-none">
          <NoteCard note={note} />
        </li>
      ))}
    </ul>
  );
}
