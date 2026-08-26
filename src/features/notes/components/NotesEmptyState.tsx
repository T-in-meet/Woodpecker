import type { NoteView } from "../schema";

type NotesEmptyStateProps = {
  query: string;
  view: NoteView;
};

const EMPTY_STATE_COPY: Record<
  NoteView,
  { title: string; description: string }
> = {
  all: {
    title: "아직 저장한 노트가 없습니다.",
    description: "첫 노트를 작성하고 복습 흐름을 시작해보세요.",
  },
  due: {
    title: "지금 학습할 노트가 없습니다.",
    description: "예정 노트에서 다음 복습 일정을 확인해보세요.",
  },
  scheduled: {
    title: "예정된 노트가 없습니다.",
    description: "노트를 학습하면 다음 복습 일정이 여기에 표시됩니다.",
  },
  completed: {
    title: "완료한 노트가 없습니다.",
    description: "모든 복습 회차를 마친 노트가 여기에 모입니다.",
  },
};

export function NotesEmptyState({ query, view }: NotesEmptyStateProps) {
  const copy = EMPTY_STATE_COPY[view];

  return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <p className="text-base font-medium text-foreground">
        {query ? `"${query}"에 대한 검색 결과가 없습니다.` : copy.title}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {query ? "다른 검색어를 입력해보세요." : copy.description}
      </p>
    </div>
  );
}
