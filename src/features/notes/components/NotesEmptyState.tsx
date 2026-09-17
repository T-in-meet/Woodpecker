import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

import type { NoteView } from "../schema";
import { buildNotesUrl } from "../utils/buildNotesUrl";

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
    title: "오늘 복습할 노트가 없습니다.",
    description: "복습 예정 노트에서 다음 복습 일정을 확인해보세요.",
  },
  scheduled: {
    title: "복습 예정 노트가 없습니다.",
    description: "노트를 작성하면 복습 일정이 여기에 표시됩니다.",
  },
  completed: {
    title: "학습을 종료한 노트가 없습니다.",
    description: "학습을 종료한 노트가 여기에 모입니다.",
  },
};

export function NotesEmptyState({ query, view }: NotesEmptyStateProps) {
  const copy = EMPTY_STATE_COPY[view];
  const action = query.trim()
    ? { label: "검색 초기화", href: buildNotesUrl({ view }) }
    : view === "due"
      ? { label: "복습 예정 보기", href: buildNotesUrl({ view: "scheduled" }) }
      : view === "completed"
        ? { label: "전체 노트 보기", href: ROUTES.NOTES }
        : {
            label: view === "all" ? "첫 노트 작성" : "노트 작성",
            href: ROUTES.NOTES_NEW,
          };

  return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <p className="text-base font-medium text-foreground">
        {query ? `"${query}"에 대한 검색 결과가 없습니다.` : copy.title}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {query ? "다른 검색어를 입력해보세요." : copy.description}
      </p>
      <Button asChild className="mt-5">
        <Link href={action.href} className="cursor-pointer">
          {action.label}
        </Link>
      </Button>
    </div>
  );
}
