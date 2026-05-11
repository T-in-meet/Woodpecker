import { NoteCardCompact } from "@/features/notes/components/NoteCardCompact";
import type { NoteSummary } from "@/features/notes/queries";

type ReviewWaitingSectionProps = {
  notes: NoteSummary[];
};

export function ReviewWaitingSection({ notes }: ReviewWaitingSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">
        복습 대기 노트{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({notes.length})
        </span>
      </h2>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          복습 대기 중인 노트가 없습니다.
        </p>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-3 sm:grid-cols-2">
          {notes.map((note) => (
            <li key={note.id}>
              <NoteCardCompact note={note} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
