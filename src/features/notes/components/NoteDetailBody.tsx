"use client";

import { NotebookPen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { QuizButton } from "@/features/quiz/components/QuizButton";
import { RelatedNotesSection } from "@/features/related-notes/components/RelatedNotesSection";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteReviewRoute } from "@/lib/constants/routes";

import { NoteEditForm } from "./NoteEditForm";
import { NoteManageMenu } from "./NoteManageMenu";
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
        {/* 상태 문구는 액션 바가 아니라 배지 줄에 둔다. 액션과 같은 줄에 있으면
            핵심 행동을 찾는 시선과 경쟁한다. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
          {/* 오렌지는 이 앱에서 학습 활동/진행량을 뜻한다(마이페이지 학습 히트맵과 동일 계열).
              복습 회차는 그 진행도라 같은 색을 쓴다. 단계를 orange-100으로 잡은 건
              퀴즈 선택지의 "선택됨"(orange-50)과 톤을 갈라두기 위해서다. */}
          <span className="rounded-full bg-orange-100 px-2 py-1 font-medium text-foreground dark:bg-orange-950/40">
            복습 {reviewRound} / {MAX_REVIEW_ROUND}
          </span>
          {isReviewCompleted && (
            <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              학습 완료
            </span>
          )}
          <span className="min-w-0">{reviewStatusMessage}</span>
        </div>
        <h1 className="mt-4 wrap-break-word break-keep text-balance text-3xl font-bold text-foreground">
          {title}
        </h1>
        {/* 왼쪽은 학습 행동, 오른쪽은 관리. 화면이 좁아지면 관리 묶음이 통째로
            내려가서 버튼이 중간에서 쪼개지지 않는다. */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {canStartReview && (
            <Button asChild>
              <Link href={getNoteReviewRoute(noteId)}>
                <NotebookPen data-icon="inline-start" aria-hidden="true" />
                백지 테스트 시작
              </Link>
            </Button>
          )}
          <QuizButton noteId={noteId} noteTitle={title} />
          <div className="sm:ml-auto">
            <NoteManageMenu
              noteId={noteId}
              noteTitle={title}
              onEdit={() => setIsEditing(true)}
              canChangeNotificationTime={!isReviewCompleted}
              notificationTimeOfDay={notificationTimeOfDay}
            />
          </div>
        </div>
      </header>

      <NoteViewer content={content} className="min-h-[60vh]" />
      <RelatedNotesSection noteId={noteId} />
    </>
  );
}
