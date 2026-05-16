"use client";

import { CalendarClock, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteDetailRoute } from "@/lib/constants/routes";
import { formatDateKST } from "@/lib/utils/formatDate";
import { stripMarkdown } from "@/lib/utils/stripMarkdown";

import type { NoteSummary } from "../queries";
import { getNextReviewText, getReviewStatus } from "../utils/noteStatus";
import { NoteActions } from "./NoteActions";

export function NoteGridCard({ note }: { note: NoteSummary }) {
  const status = getReviewStatus(note);
  const nextReviewText = getNextReviewText(status, note.next_review_at);
  const canReview = status === "available";
  const contentPreview = useMemo(
    () => stripMarkdown(note.content),
    [note.content],
  );

  return (
    <Link
      href={getNoteDetailRoute(note.id)}
      className="group block h-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="h-full transition-shadow duration-200 hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          {/* Title */}
          <span className="line-clamp-1 min-w-0 wrap-break-word text-base font-bold leading-snug">
            {note.title}
          </span>

          {/* Content preview */}
          {note.content.trim() && (
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {contentPreview}
            </p>
          )}

          {/* Review count */}
          <span className="inline-flex w-fit items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
            복습 {note.review_round} / {MAX_REVIEW_ROUND}
          </span>

          {/* Metadata */}
          <div className="mt-auto space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              다음 복습: {nextReviewText}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                생성일: {formatDateKST(note.created_at)}
              </div>

              <NoteActions
                noteId={note.id}
                canReview={canReview}
                variant="grid"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
