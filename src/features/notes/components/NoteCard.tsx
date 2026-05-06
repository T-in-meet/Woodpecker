"use client";

import { CalendarDays, Play, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteDetailRoute } from "@/lib/constants/routes";
import { formatDateKST } from "@/lib/utils/formatDate";

import { useNoteCardActions } from "../hooks/useNoteCardActions";
import type { NoteSummary } from "../queries";
import { getNextReviewText, getReviewStatus } from "../utils/noteStatus";

export function NoteCard({ note }: { note: NoteSummary }) {
  const status = getReviewStatus(note);
  const nextReviewText = getNextReviewText(status, note.next_review_at);
  const canReview = status === "available";

  const { isDeleting, handleStartReview, handleDelete } = useNoteCardActions(
    note.id,
  );

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
              {note.content}
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

            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {canReview && (
                <button
                  type="button"
                  onClick={handleStartReview}
                  aria-label="복습 시작"
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-500 px-2.5 text-xs font-medium text-white cursor-pointer transition-colors hover:bg-emerald-600"
                >
                  <Play className="h-3.5 w-3.5" />
                  복습 시작
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label="노트 삭제"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground cursor-pointer transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
