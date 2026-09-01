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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BlankTestPage,
  type RestoredReviewSession,
} from "@/features/review/components/BlankTestPage";
import { hashNoteContent } from "@/features/review/lib/contentHash";
import {
  getGradingByReviewLog,
  getNoteContentForComparison,
  getPendingReviewLog,
  getReviewableNote,
} from "@/features/review/queries";
import { getNoteDetailRoute, ROUTES } from "@/lib/constants/routes";
import { logError } from "@/lib/logger";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "백지 테스트",
  robots: { index: false, follow: false },
};

/**
 * AI 채점 서버 액션은 이 페이지의 요청으로 실행되므로 여기의 maxDuration을 따른다.
 *
 * 세 값의 순서를 지켜야 한다.
 *   채점 deadline(60초, gradeAnswerAction) < 이 값(90초) < 선점 만료(120초, claim_review_grading)
 *
 * 채점 deadline은 액션 진입 시각부터 재므로 이 값보다 먼저 걸리는 것이 보장된다.
 * 이 값이 선점 만료보다 커지면, 느린 AI 호출이 진행 중인 사이 선점이 만료돼
 * 사용자의 재시도가 선점을 이어받고 원래 요청 결과는 stale_claim으로 버려진다.
 * 채점 1건에 AI를 두 번 부르는 셈이라 느린 요청일수록 비용이 두 배가 된다.
 *
 * reasoning_effort=low 적용 후 약 100,000자 채점도 8.9초에 완주했다. AI deadline과
 * 선점 만료 사이에 플랫폼·DB 후처리 여유 30초를 두어 90초로 정했다.
 *
 * Next.js가 정적으로 읽는 값이라 상수를 import해서 쓸 수 없다.
 */
export const maxDuration = 90;

function NoteReviewBreadcrumb({
  noteId,
  noteTitle,
}: {
  noteId: string;
  noteTitle: string;
}) {
  return (
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
          <BreadcrumbLink asChild>
            <Link
              href={getNoteDetailRoute(noteId)}
              className="block max-w-36 truncate sm:max-w-xs"
              title={noteTitle}
            >
              {noteTitle}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="font-medium">백지 테스트</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default async function NoteReviewPage({
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

  const [note, pendingReviewLog] = await Promise.all([
    getReviewableNote(noteId, user.id),
    getPendingReviewLog(noteId, user.id),
  ]);

  if (!note) {
    notFound();
  }

  if (!pendingReviewLog) {
    const isCompleted = Boolean(note.review_completed_at);

    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10 md:px-12">
        <NoteReviewBreadcrumb noteId={noteId} noteTitle={note.title} />
        <div className="flex min-h-[50vh] items-center">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-2xl">
                {isCompleted
                  ? "이 노트는 모든 복습을 마쳤습니다."
                  : "진행 중인 백지 테스트가 없습니다."}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {isCompleted
                  ? "필요하면 노트 상세 페이지에서 내용을 다시 확인해보세요."
                  : "현재 진행할 리뷰 로그를 찾지 못했습니다. 노트 상세로 돌아가 상태를 확인해주세요."}
              </p>

              <Button asChild>
                <Link href={getNoteDetailRoute(noteId)}>노트로 돌아가기</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 이미 채점을 받은 회차면 답안·채점·원본을 복원해 비교 화면부터 보여준다.
  // 복원하지 않으면 완료 버튼을 보려고 답안을 다시 써야 하고, 그 답안은 저장된 채점
  // 기준과 달라 "다른 답안을 채점한 결과" 안내로 이어진다.
  // 여기도 fail-open이다. 복원에 실패해도 백지 테스트 자체는 진행할 수 있어야 한다.
  let restoredSession: RestoredReviewSession | null = null;
  try {
    const grading = await getGradingByReviewLog(pendingReviewLog.id, user.id);

    if (grading) {
      const noteContent = await getNoteContentForComparison(noteId, user.id);

      if (noteContent) {
        const contentHash = hashNoteContent(noteContent.content);

        restoredSession = {
          originalContent: noteContent.content,
          originalContentHash: contentHash,
          userAnswer: grading.user_answer,
          reviewLogId: pendingReviewLog.id,
          grading: { score: grading.score, ...grading.feedback },
          // 채점을 받은 뒤 노트를 고쳤으면 화면의 원본과 채점 기준이 다르다.
          // 해시 도입 이전 행은 NULL이라 판단할 근거가 없으므로 알리지 않는다.
          basisContentChanged:
            grading.graded_content_hash !== null &&
            grading.graded_content_hash !== contentHash,
        };
      }
    }
  } catch (error) {
    logError(error);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 md:px-12">
      <NoteReviewBreadcrumb noteId={noteId} noteTitle={note.title} />
      <BlankTestPage
        noteId={noteId}
        noteTitle={note.title}
        restoredSession={restoredSession}
        reviewRound={pendingReviewLog.round}
      />
    </div>
  );
}
