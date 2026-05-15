"use client";

import { CalendarDays, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteDetailRoute } from "@/lib/constants/routes";
import { formatDateKST } from "@/lib/utils/formatDate";
import { stripMarkdown } from "@/lib/utils/stripMarkdown";

import type { NoteSummary } from "../queries";
import { getNextReviewText, getReviewStatus } from "../utils/noteStatus";
import { NoteActions } from "./NoteActions";

export function NoteListItem({ note }: { note: NoteSummary }) {
  const status = getReviewStatus(note);
  const nextReviewText = getNextReviewText(status, note.next_review_at);
  const canReview = status === "available";

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
              {stripMarkdown(note.content)}
            </p>
          )}

          <div className="my-3.5 border-t" />

          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                다음 복습: {nextReviewText}
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                생성일: {formatDateKST(note.created_at)}
              </div>
            </div>

            <NoteActions
              noteId={note.id}
              canReview={canReview}
              variant="list"
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
