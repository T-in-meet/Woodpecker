"use client";

import { Play, Trash2 } from "lucide-react";

import { useNoteActions } from "../hooks/useNoteActions";

type NoteActionsProps = {
  noteId: string;
  canReview: boolean;
  variant: "grid" | "list";
};

export function NoteActions({ noteId, canReview, variant }: NoteActionsProps) {
  const { isDeleting, handleStartReview, handleDelete } =
    useNoteActions(noteId);

  const isCompact = variant === "grid";

  // 아웃라인 초록. 글자색은 흰 배경 대비 AA를 위해 emerald-700을 쓰고 테두리는 한 단계 연하게 둔다.
  const reviewClass = isCompact
    ? "inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-600/40 text-emerald-700 cursor-pointer transition-colors hover:bg-emerald-50"
    : "inline-flex h-8 items-center gap-1 rounded-md border border-emerald-600/40 px-2.5 text-xs font-medium text-emerald-700 cursor-pointer transition-colors hover:bg-emerald-50";

  const deleteClass = isCompact
    ? "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground cursor-pointer transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
    : "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground cursor-pointer transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50";

  const iconClass = isCompact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className="flex shrink-0 items-center gap-1">
      {canReview && (
        <button
          type="button"
          onClick={handleStartReview}
          aria-label="복습 시작"
          className={reviewClass}
        >
          <Play className="h-3.5 w-3.5" />
          {!isCompact && "복습 시작"}
        </button>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label="노트 삭제"
        className={deleteClass}
      >
        <Trash2 className={iconClass} />
      </button>
    </div>
  );
}
