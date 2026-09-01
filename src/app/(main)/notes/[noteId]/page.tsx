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
import { ScrollToTopButton } from "@/features/notes/components/ScrollToTopButton";
import { ScrollToTopOnMount } from "@/features/notes/components/ScrollToTopOnMount";
import { getNoteById } from "@/features/notes/queries";
import {
  canStartReview,
  getReviewStatus,
} from "@/features/notes/utils/noteStatus";
import { GradingHistorySection } from "@/features/review/components/GradingHistorySection";
import {
  getGradingsByNote,
  hasCompletedReviewForNoteToday,
} from "@/features/review/queries";
import { ROUTES } from "@/lib/constants/routes";
import { logError } from "@/lib/logger";
import { getUser } from "@/lib/supabase/getUser";
import { formatDateTime } from "@/lib/utils/formatDate";

export const metadata: Metadata = {
  title: "노트 상세",
  robots: { index: false, follow: false },
};

/**
 * AI 퀴즈 생성 서버 액션(generateQuiz·regenerateQuiz)은 이 페이지의 요청으로 실행되므로
 * 여기의 maxDuration을 따른다.
 *
 * claim_quiz_generation_v2의 in-flight 창(120초)보다 짧아야 한다.
 * 이 값이 그 창보다 커지면, 느린 AI 호출이 진행 중인 사이 선점이 만료돼 사용자의
 * 재시도가 선점을 이어받고 원래 요청 결과는 stale_claim으로 버려진다. 퀴즈 1건에
 * AI를 두 번 부르는 셈이라 느린 요청일수록 비용이 두 배가 된다.
 *
 * reasoning_effort=low Day 3 stress canary의 최댓값은 16.7초였다. AI deadline 60초와
 * in-flight 창 120초 사이에 플랫폼·DB 후처리 여유 30초를 두어 90초로 정했다.
 *
 * Next.js가 정적으로 읽는 값이라 상수를 import해서 쓸 수 없다.
 */
export const maxDuration = 90;

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  const user = await getUser();

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
  // 완료 판정도 목록과 공유한다. 사용자가 직접 끝냈거나 회차 상한까지 채운 노트다.
  const isReviewCompleted = getReviewStatus(note) === "completed";
  const isCompletedByUser = Boolean(note.review_completed_at);
  const isReviewDue =
    nextScheduledAt !== null &&
    new Date(nextScheduledAt).getTime() <= Date.now();

  // 진입 조건은 노트 목록과 공유한다. 오늘 이미 복습을 완료했어도 다시 들어올 수 있고,
  // 완료 처리가 가능한지는 백지 테스트 화면이 따로 판단한다.
  const canReview = canStartReview(note);

  // 완료 버튼 비활성 여부와 상태 문구에만 쓴다. 진입은 이 값으로 막지 않는다.
  const alreadyCompletedTodayPromise = canReview
    ? hasCompletedReviewForNoteToday(noteId, user.id).catch((error) => {
        // 일시적 조회 실패 시 fail-open(false) — 실제 차단은 DB 부분 unique
        // 인덱스와 RPC가 보증하므로 페이지 표시를 막지 않는다.
        logError(error);
        return false;
      })
    : Promise.resolve(false);

  const gradingsPromise = getGradingsByNote(noteId, user.id).catch((error) => {
    // 채점 기록은 부가 정보 — 조회 실패 시 섹션만 숨기고 페이지 표시를 막지 않는다.
    logError(error);
    return [];
  });

  const [alreadyCompletedToday, gradings] = await Promise.all([
    alreadyCompletedTodayPromise,
    gradingsPromise,
  ]);

  const reviewStatusMessage = isCompletedByUser
    ? "복습을 완료한 노트입니다."
    : isReviewCompleted
      ? "1-3-7 복습을 모두 마쳤습니다."
      : nextScheduledAt
        ? alreadyCompletedToday
          ? `오늘 백지 테스트 완료 · 다음 복습 일정: ${formatDateTime(nextScheduledAt)}`
          : isReviewDue
            ? "지금 백지 테스트를 진행할 수 있습니다."
            : `다음 복습 일정: ${formatDateTime(nextScheduledAt)}`
        : "다음 복습 일정이 아직 준비되지 않았습니다.";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 md:px-12">
      <ScrollToTopOnMount />
      <ScrollToTopButton />
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
              className="max-w-45 truncate font-medium sm:max-w-xs"
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
        isCompletedByUser={isCompletedByUser}
        canStartReview={canReview}
        reviewStatusMessage={reviewStatusMessage}
        notificationTimeOfDay={note.notification_time_of_day}
        nextScheduledAt={nextScheduledAt}
      />

      <GradingHistorySection gradings={gradings} />
    </div>
  );
}
