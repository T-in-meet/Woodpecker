import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DeleteNoteDialog } from "@/features/notes/components/DeleteNoteDialog";
import { NoteViewer } from "@/features/notes/components/NoteViewer";
import { getNoteById } from "@/features/notes/queries";
import { NotificationTimePicker } from "@/features/notifications/components/NotificationTimePicker";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteReviewRoute, ROUTES } from "@/lib/constants/routes";
import { createServerComponentClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils/formatDate";

export const metadata: Metadata = {
  title: "노트 상세",
  robots: { index: false, follow: false },
};

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  if (user.email_confirmed_at == null) {
    redirect(ROUTES.VERIFY_EMAIL);
  }

  const note = await getNoteById(noteId, user.id);

  if (!note) {
    notFound();
  }

  const nextReviewAt = note.next_review_at;
  const isReviewCompleted =
    note.review_round >= MAX_REVIEW_ROUND && nextReviewAt === null;
  const canStartReview = !isReviewCompleted && nextReviewAt !== null;
  const isReviewDue =
    nextReviewAt !== null && new Date(nextReviewAt).getTime() <= Date.now();
  const reviewStatusMessage = isReviewCompleted
    ? "1-3-7 복습을 모두 마쳤습니다."
    : nextReviewAt
      ? isReviewDue
        ? "지금 백지 테스트를 진행할 수 있습니다."
        : `다음 백지 테스트 예정 ${formatDateTime(nextReviewAt)}. 원하면 지금 미리 진행할 수 있습니다.`
      : "다음 복습 일정이 아직 준비되지 않았습니다.";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 md:px-12">
      <header className="border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-1 font-medium text-foreground">
            복습 {note.review_round} / {MAX_REVIEW_ROUND}
          </span>
          {isReviewCompleted && (
            <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-700">
              학습 완료
            </span>
          )}
        </div>
        <h1 className="mt-4 text-3xl font-bold text-foreground">
          {note.title}
        </h1>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{reviewStatusMessage}</p>
          <div className="flex flex-wrap items-center gap-2">
            {canStartReview && (
              <Button asChild size="sm">
                <Link href={getNoteReviewRoute(noteId)}>백지 테스트 시작</Link>
              </Button>
            )}
            <DeleteNoteDialog noteId={note.id} noteTitle={note.title} />
          </div>
        </div>
      </header>

      <NotificationTimePicker
        noteId={note.id}
        initialTime={note.notification_time_of_day}
        nextReviewAt={note.next_review_at}
      />

      <NoteViewer content={note.content} className="min-h-[60vh]" />
    </div>
  );
}
