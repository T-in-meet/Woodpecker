import type { NoteSummary } from "../queries";
import type { NotesView } from "../utils/buildNotesUrl";
import { NoteGridCard } from "./NoteGridCard";
import { NoteListItem } from "./NoteListItem";
import { NotesEmptyState } from "./NotesEmptyState";
import { NotesPagination } from "./NotesPagination";

type NotesViewContainerProps = {
  notes: NoteSummary[];
  total: number;
  currentPage: number;
  pageSize: number;
  view: NotesView;
  query: string;
};

export function NotesViewContainer({
  notes,
  total,
  currentPage,
  pageSize,
  view,
  query,
}: NotesViewContainerProps) {
  if (total === 0) {
    return <NotesEmptyState query={query} />;
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {query ? `"${query}" 검색 결과 ${total}개` : `총 ${total}개`}
      </p>

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

      <NotesPagination
        currentPage={currentPage}
        totalPages={totalPages}
        query={query}
        view={view}
      />
    </div>
  );
}
