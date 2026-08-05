import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NoteDetailBody } from "@/features/notes/components/NoteDetailBody";
import { ScrollToTopOnMount } from "@/features/notes/components/ScrollToTopOnMount";
import { getNoteById } from "@/features/notes/queries";
import { hasCompletedReviewForNoteToday } from "@/features/review/queries";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { ROUTES } from "@/lib/constants/routes";
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
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={ROUTES.HOME}>홈</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={ROUTES.NOTES}>노트 목록</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {/* 제목이 길면 breadcrumb가 여러 줄로 밀리므로 잘라내고 전체 제목은 title로 노출한다. */}
            <BreadcrumbPage
              className="max-w-[180px] truncate font-medium sm:max-w-xs"
              title={note.title}
            >
              {note.title}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <NoteDetailBody
        noteId={note.id}
        title={note.title}
        content={note.content}
        reviewRound={note.review_round}
        isReviewCompleted={isReviewCompleted}
        canStartReview={canStartReview}
        reviewStatusMessage={reviewStatusMessage}
        notificationTimeOfDay={note.notification_time_of_day}
        nextScheduledAt={note.next_scheduled_at}
      />
    </div>
  );
}
