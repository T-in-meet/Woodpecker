"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { NotificationTimePicker } from "@/features/notifications/components/NotificationTimePicker";
import { QuizButton } from "@/features/quiz/components/QuizButton";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteReviewRoute } from "@/lib/constants/routes";

import { DeleteNoteDialog } from "./DeleteNoteDialog";
import { NoteEditForm } from "./NoteEditForm";
import { NoteViewer } from "./NoteViewer";

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
  title,
  content,
  reviewRound,
  isReviewCompleted,
  canStartReview,
  reviewStatusMessage,
  notificationTimeOfDay,
  nextScheduledAt,
}: NoteDetailBodyProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const handleSaved = useCallback(() => {
    setIsEditing(false);
    router.refresh();
  }, [router]);

  if (isEditing) {
    return (
      <NoteEditForm
        noteId={noteId}
        initialTitle={title}
        initialContent={content}
        onCancel={() => setIsEditing(false)}
        onSaved={handleSaved}
      />
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
          {title}
        </h1>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{reviewStatusMessage}</p>
          <div className="flex flex-wrap items-center gap-2">
            <QuizButton noteId={noteId} noteTitle={title} />
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
              onClick={() => setIsEditing(true)}
              aria-label="노트 수정"
              className="cursor-pointer"
            >
              <Pencil className="size-3.5" />
              수정
            </Button>
            <DeleteNoteDialog noteId={noteId} noteTitle={title} />
          </div>
        </div>
      </header>

      <NoteViewer content={content} className="min-h-[60vh]" />
    </>
  );
}
