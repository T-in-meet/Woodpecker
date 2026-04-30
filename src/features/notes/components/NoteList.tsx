import type { NoteSummary } from "../queries";
import { NoteCard } from "./NoteCard";
import { NoteCardCompact } from "./NoteCardCompact";
import { NotesPagination } from "./NotesPagination";

type NoteListProps = {
  notes: NoteSummary[];
  total: number;
  currentPage: number;
  pageSize: number;
  view: "list" | "cards";
  query: string;
};

export function NoteList({
  notes,
  total,
  currentPage,
  pageSize,
  view,
  query,
}: NoteListProps) {
  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
        <p className="text-base font-medium text-foreground">
          {query
            ? `"${query}"에 대한 검색 결과가 없습니다.`
            : "아직 저장한 노트가 없습니다."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {query
            ? "다른 검색어를 입력해보세요."
            : "첫 노트를 작성하고 복습 흐름을 시작해보세요."}
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {query ? `"${query}" 검색 결과 ${total}개` : `총 ${total}개`}
      </p>

      {view === "cards" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {notes.map((note) => (
            <li key={note.id} className="list-none">
              <NoteCardCompact note={note} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="list-none">
              <NoteCard note={note} />
            </li>
          ))}
        </ul>
      )}

      <NotesPagination currentPage={currentPage} totalPages={totalPages} view={view} query={query} />
    </div>
  );
}
