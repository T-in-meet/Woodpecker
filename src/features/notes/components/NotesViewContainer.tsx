import type { NoteSummary } from "../queries";
import type { NoteView } from "../schema";
import { buildNotesUrl } from "../utils/buildNotesUrl";
import { NoteListItem } from "./NoteListItem";
import { NotesEmptyState } from "./NotesEmptyState";
import { NotesPagination } from "./NotesPagination";

type NotesViewContainerProps = {
  notes: NoteSummary[];
  total: number;
  currentPage: number;
  pageSize: number;
  query: string;
  view: NoteView;
};

export function NotesViewContainer({
  notes,
  total,
  currentPage,
  pageSize,
  query,
  view,
}: NotesViewContainerProps) {
  if (total === 0) {
    return <NotesEmptyState query={query} view={view} />;
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {query
          ? `"${query}" 검색 결과 ${total}개`
          : view === "all"
            ? `총 ${total}개`
            : `${
                view === "due"
                  ? "오늘 복습할 노트"
                  : view === "scheduled"
                    ? "복습 예정 노트"
                    : "복습 완료 노트"
              } ${total}개`}
      </p>

      <ul className="flex list-none flex-col gap-3">
        {notes.map((note) => (
          <li key={note.id}>
            <NoteListItem note={note} query={query} />
          </li>
        ))}
      </ul>

      <NotesPagination
        currentPage={currentPage}
        totalPages={totalPages}
        buildUrl={(page) => buildNotesUrl({ page, query, view })}
      />
    </div>
  );
}
