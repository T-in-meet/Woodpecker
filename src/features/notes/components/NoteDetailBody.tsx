"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { TipTapEditor } from "@/features/editor/components/TipTapEditor";
import { NotificationTimePicker } from "@/features/notifications/components/NotificationTimePicker";
import { usePreventPageLeave } from "@/hooks/usePreventPageLeave";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteReviewRoute } from "@/lib/constants/routes";

import { updateNoteAction } from "../actions";
import { DeleteNoteDialog } from "./DeleteNoteDialog";
import { NoteViewer } from "./NoteViewer";

const CONTENT_MAX_LENGTH = 50000;

type NoteDetailBodyProps = {
  noteId: string;
  title: string;
  content: string;
  reviewRound: number;
  isReviewCompleted: boolean;
  canStartReview: boolean;
  reviewStatusMessage: string;
  notificationTimeOfDay: string | null;
  nextScheduledAt: string | null;
};

export function NoteDetailBody({
  noteId,
  title: initialTitle,
  content: initialContent,
  reviewRound,
  isReviewCompleted,
  canStartReview,
  reviewStatusMessage,
  notificationTimeOfDay,
  nextScheduledAt,
}: NoteDetailBodyProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [state, formAction, isPending] = useActionState(
    updateNoteAction.bind(null, noteId),
    null,
  );

  const fieldErrors =
    state?.error && typeof state.error === "object" ? state.error : null;
  const generalError =
    state?.error && typeof state.error === "string" ? state.error : null;

  const isDirty =
    isEditing && (title !== initialTitle || content !== initialContent);
  usePreventPageLeave(isDirty);

  useEffect(() => {
    if (state?.success) {
      setIsEditing(false);
      router.refresh();
    }
  }, [state, router]);

  function handleStartEditing() {
    setTitle(initialTitle);
    setContent(initialContent);
    setIsEditing(true);
  }

  function handleCancel() {
    setTitle(initialTitle);
    setContent(initialContent);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <form action={formAction}>
        {generalError && (
          <p role="alert" className="pb-2 text-xs text-destructive">
            {generalError}
          </p>
        )}
        <input
          name="title"
          aria-label="제목"
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          className="w-full border-none bg-transparent text-3xl font-bold leading-snug text-foreground focus:outline-none"
        />
        {fieldErrors?.title && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {fieldErrors.title.join(" ")}
          </p>
        )}

        <input type="hidden" name="content" value={content} />
        {fieldErrors?.content && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {fieldErrors.content.join(" ")}
          </p>
        )}

        <TipTapEditor
          value={content}
          onChange={setContent}
          aria-label="내용"
          className="mt-4 [&_.tiptap]:min-h-[60vh]"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isPending}
          >
            취소
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isPending || content.length > CONTENT_MAX_LENGTH}
          >
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <>
      <header className="border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-1 font-medium text-foreground">
            복습 {reviewRound} / {MAX_REVIEW_ROUND}
          </span>
          {isReviewCompleted && (
            <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-700">
              학습 완료
            </span>
          )}
        </div>
        <h1 className="mt-4 wrap-break-word break-keep text-3xl font-bold text-foreground">
          {initialTitle}
        </h1>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{reviewStatusMessage}</p>
          <div className="flex flex-wrap items-center gap-2">
            {canStartReview && (
              <Button asChild size="sm">
                <Link href={getNoteReviewRoute(noteId)}>백지 테스트 시작</Link>
              </Button>
            )}
            {!isReviewCompleted && (
              <NotificationTimePicker
                noteId={noteId}
                initialTime={notificationTimeOfDay}
                nextScheduledAt={nextScheduledAt}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartEditing}
              aria-label="노트 수정"
              className="cursor-pointer"
            >
              <Pencil className="size-3.5" />
              수정
            </Button>
            <DeleteNoteDialog noteId={noteId} noteTitle={initialTitle} />
          </div>
        </div>
      </header>

      <NoteViewer content={initialContent} className="min-h-[60vh]" />
    </>
  );
}
