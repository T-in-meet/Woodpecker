import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DeleteNoteDialog } from "@/features/notes/components/DeleteNoteDialog";
import { NoteViewer } from "@/features/notes/components/NoteViewer";
import { ScrollToTopOnMount } from "@/features/notes/components/ScrollToTopOnMount";
import { getNoteById } from "@/features/notes/queries";
import { NotificationTimePicker } from "@/features/notifications/components/NotificationTimePicker";
import { QuizButton } from "@/features/quiz/components/QuizButton";
import { GradingHistorySection } from "@/features/review/components/GradingHistorySection";
import {
  getGradingsByNote,
  hasCompletedReviewForNoteToday,
  type ReviewGrading,
} from "@/features/review/queries";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteReviewRoute, ROUTES } from "@/lib/constants/routes";
import { logError } from "@/lib/logger";
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
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
  }

  const note = await getNoteById(noteId, user.id);

  if (!note) {
    notFound();
  }

  const nextReviewAt = note.next_review_at;
  const nextScheduledAt = note.next_scheduled_at ?? nextReviewAt;
  const isReviewCompleted =
    note.review_round >= MAX_REVIEW_ROUND && nextReviewAt === null;
  const isReviewDue =
    nextScheduledAt !== null &&
    new Date(nextScheduledAt).getTime() <= Date.now();

  // 1일 1회 제한 힌트. 일시적 조회 실패 시 fail-open(false) — 실제 차단은
  // DB 부분 unique 인덱스와 RPC가 보증하므로 페이지 표시를 막지 않는다.
  let alreadyCompletedToday = false;
  if (!isReviewCompleted && nextReviewAt !== null) {
    try {
      alreadyCompletedToday = await hasCompletedReviewForNoteToday(
        noteId,
        user.id,
      );
    } catch (error) {
      logError(error);
    }
  }

  // 채점 기록은 부가 정보 — 조회 실패 시 섹션만 숨기고 페이지 표시를 막지 않는다.
  let gradings: ReviewGrading[] = [];
  try {
    gradings = await getGradingsByNote(noteId, user.id);
  } catch (error) {
    logError(error);
  }

  const canStartReview =
    !isReviewCompleted && nextReviewAt !== null && !alreadyCompletedToday;
  const reviewStatusMessage = isReviewCompleted
    ? "1-3-7 복습을 모두 마쳤습니다."
    : nextScheduledAt
      ? alreadyCompletedToday
        ? `오늘 백지 테스트 완료. 다음 예정: ${formatDateTime(nextScheduledAt)}`
        : isReviewDue
          ? "지금 백지 테스트를 진행할 수 있습니다."
          : `다음 예정: ${formatDateTime(nextScheduledAt)}`
      : "다음 복습 일정이 아직 준비되지 않았습니다.";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 md:px-12">
      <ScrollToTopOnMount />
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
        <h1 className="mt-4 wrap-break-word break-keep text-3xl font-bold text-foreground">
          {note.title}
        </h1>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{reviewStatusMessage}</p>
          <div className="flex flex-wrap items-center gap-2">
            <QuizButton noteId={note.id} noteTitle={note.title} />
            {canStartReview && (
              <Button asChild size="sm">
                <Link href={getNoteReviewRoute(noteId)}>백지 테스트 시작</Link>
              </Button>
            )}
            {!isReviewCompleted && (
              <NotificationTimePicker
                noteId={note.id}
                initialTime={note.notification_time_of_day}
                nextScheduledAt={note.next_scheduled_at}
              />
            )}
            <DeleteNoteDialog noteId={note.id} noteTitle={note.title} />
          </div>
        </div>
      </header>

      <NoteViewer content={note.content} className="min-h-[60vh]" />

      <GradingHistorySection gradings={gradings} />
    </div>
  );
}
