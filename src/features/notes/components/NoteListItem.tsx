import { CalendarClock } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { stripNoteColorSyntax } from "@/features/editor/utils/noteColorMarkdown";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteDetailRoute } from "@/lib/constants/routes";
import { stripMarkdown } from "@/lib/utils/stripMarkdown";

import type { NoteSummary } from "../queries";
import { getNextReviewText, getReviewStatus } from "../utils/noteStatus";
import { NoteActions } from "./NoteActions";

export function NoteListItem({ note }: { note: NoteSummary }) {
  const status = getReviewStatus(note);
  const nextReviewText = getNextReviewText(status, note.next_review_at);
  const canReview = status === "available";
  const contentPreview = stripMarkdown(stripNoteColorSyntax(note.content));
  const isUpcomingRelative =
    nextReviewText === "내일" || nextReviewText.endsWith("일 후");
  const reviewTextClass =
    nextReviewText === "오늘"
      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
      : isUpcomingRelative
        ? "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
        : "font-medium text-foreground";

  return (
    <Link
      href={getNoteDetailRoute(note.id)}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
    >
      <Card className="transition-shadow duration-200 hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="min-w-0 truncate text-base font-semibold leading-snug">
              {note.title}
            </span>
            <span className="inline-flex shrink-0 items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
              복습 {note.review_round} / {MAX_REVIEW_ROUND}
            </span>
          </div>

          {note.content.trim() && (
            <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
              {contentPreview}
            </p>
          )}

          <div className="my-3.5 border-t" />

          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            {/* 날짜가 단어 중간에서 끊기지 않도록 nowrap을 건다. */}
            <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              <span>다음 복습일</span>
              <span className={reviewTextClass}>{nextReviewText}</span>
            </div>

            <NoteActions noteId={note.id} canReview={canReview} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
