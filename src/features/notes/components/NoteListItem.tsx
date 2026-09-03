import { CalendarClock } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { getNoteDetailRoute } from "@/lib/constants/routes";

import type { NoteSummary } from "../queries";
import {
  getNoteSearchPreview,
  highlightSearchText,
} from "../utils/noteSearchPreview";
import {
  canStartReview,
  getReviewScheduleDisplay,
  getReviewStatus,
} from "../utils/noteStatus";
import { NoteActions } from "./NoteActions";

function HighlightedText({ text, query }: { text: string; query: string }) {
  return highlightSearchText(text, query).map((part, index) =>
    part.matched ? (
      <mark
        key={index}
        className="rounded-sm bg-amber-100 text-foreground dark:bg-amber-900/60"
      >
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

export function NoteListItem({
  note,
  query = "",
}: {
  note: NoteSummary;
  query?: string;
}) {
  const status = getReviewStatus(note);
  const reviewSchedule = getReviewScheduleDisplay(status, note.next_review_at);
  const canReview = canStartReview(note);
  const isSearching = query.trim().length > 0;
  const contentPreview = getNoteSearchPreview(note.title, note.content, query);
  const reviewTextClass =
    reviewSchedule.tone === "overdue"
      ? "rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-800"
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
            <span
              className={`min-w-0 text-base font-semibold leading-snug ${isSearching ? "[overflow-wrap:anywhere]" : "truncate"}`}
            >
              <HighlightedText text={note.title} query={query} />
            </span>
            <span className="inline-flex shrink-0 items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
              복습 {note.review_round}회
            </span>
          </div>

          {note.content.trim() && (
            <p
              className={`mt-2 text-sm text-muted-foreground ${isSearching ? "[overflow-wrap:anywhere]" : "line-clamp-1"}`}
            >
              <HighlightedText text={contentPreview.text} query={query} />
            </p>
          )}
          {contentPreview.sourceOnlyMatch && (
            <p className="mt-2 text-xs text-muted-foreground">
              노트 원문에서 검색어가 일치합니다.
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
