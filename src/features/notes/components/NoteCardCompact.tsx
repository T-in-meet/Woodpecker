import { CalendarClock, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteDetailRoute } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { formatDateKST } from "@/lib/utils/formatDate";

import type { NoteSummary } from "../queries";

type ReviewStatus = "available" | "completed" | "scheduled" | "pending";

function getReviewStatus(note: NoteSummary): ReviewStatus {
  if (note.review_round >= MAX_REVIEW_ROUND && note.next_review_at === null)
    return "completed";
  if (!note.next_review_at) return "pending";
  if (new Date(note.next_review_at).getTime() <= Date.now()) return "available";
  return "scheduled";
}

const statusBadge: Record<ReviewStatus, { label: string; className: string }> =
  {
    available: {
      label: "테스트 가능",
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    },
    completed: {
      label: "학습 완료",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    },
    scheduled: {
      label: "복습 예정",
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    },
    pending: {
      label: "준비 중",
      className: "bg-muted text-muted-foreground",
    },
  };

export function NoteCardCompact({ note }: { note: NoteSummary }) {
  const status = getReviewStatus(note);
  const badge = statusBadge[status];

  const nextReviewText =
    status === "completed"
      ? "완료"
      : status === "pending"
        ? "준비 중"
        : note.next_review_at
          ? formatDateKST(note.next_review_at)
          : "-";

  return (
    <Link
      href={getNoteDetailRoute(note.id)}
      className="block h-full cursor-pointer"
    >
      <Card className="h-full transition-shadow duration-200 hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          {/* Title */}
          <span className="line-clamp-2 min-w-0 text-base font-bold leading-snug">
            {note.title}
          </span>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {note.review_round}회 완료
            </span>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium",
                badge.className,
              )}
            >
              {badge.label}
            </span>
          </div>

          {/* Metadata */}
          <div className="mt-auto space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5 flex-shrink-0" />
              다음 복습: {nextReviewText}
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" />
              생성일: {formatDateKST(note.created_at)}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
