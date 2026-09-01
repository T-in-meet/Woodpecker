import { CalendarClock } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { stripNoteColorSyntax } from "@/features/editor/utils/noteColorMarkdown";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteDetailRoute } from "@/lib/constants/routes";
import { stripMarkdown } from "@/lib/utils/stripMarkdown";

import type { NoteSummary } from "../queries";
import {
  canStartReview,
  getReviewScheduleDisplay,
  getReviewStatus,
} from "../utils/noteStatus";
import { NoteActions } from "./NoteActions";

export function NoteListItem({ note }: { note: NoteSummary }) {
  const status = getReviewStatus(note);
  const reviewSchedule = getReviewScheduleDisplay(status, note.next_review_at);
  const canReview = canStartReview(note);
  const contentPreview = stripMarkdown(stripNoteColorSyntax(note.content));
  const reviewTextClass =
    reviewSchedule.tone === "overdue"
      ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
      : reviewSchedule.tone === "today"
        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
        : reviewSchedule.tone === "upcoming"
          ? "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
          : "font-medium text-foreground";

  return (
    <Card className="relative transition-shadow duration-200 hover:shadow-md">
      <Link
        href={getNoteDetailRoute(note.id)}
        className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
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

          <div
            className={`flex min-h-8 items-center gap-4 text-sm text-muted-foreground ${
              canReview ? "pr-32" : "pr-10"
            }`}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 whitespace-nowrap">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              <span>{reviewSchedule.label}</span>
              <span className={reviewTextClass}>
                {reviewSchedule.primaryText}
              </span>
            </div>
          </div>
        </CardContent>
      </Link>

      <div className="absolute right-5 bottom-5 z-10">
        <NoteActions
          noteId={note.id}
          noteTitle={note.title}
          canReview={canReview}
        />
      </div>
    </Card>
  );
}
