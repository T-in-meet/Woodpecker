import { CalendarDays, CheckCircle2, Clock, Loader2 } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteDetailRoute } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/formatDate";

import type { NoteSummary } from "../queries";

type ReviewStatus = "available" | "completed" | "scheduled" | "pending";

function getReviewStatus(note: NoteSummary): ReviewStatus {
  if (note.review_round >= MAX_REVIEW_ROUND && note.next_review_at === null)
    return "completed";
  if (!note.next_review_at) return "pending";
  if (new Date(note.next_review_at).getTime() <= Date.now()) return "available";
  return "scheduled";
}

const statusConfig: Record<
  ReviewStatus,
  { label: string; badge: string; icon: React.ReactNode }
> = {
  available: {
    label: "테스트 가능",
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  completed: {
    label: "학습 완료",
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  scheduled: {
    label: "복습 예정",
    badge:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  pending: {
    label: "준비 중",
    badge: "bg-muted text-muted-foreground border-border",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
};

export function NoteCard({ note }: { note: NoteSummary }) {
  const status = getReviewStatus(note);
  const { badge, icon, label } = statusConfig[status];

  return (
    <Link href={getNoteDetailRoute(note.id)} className="block cursor-pointer">
      <Card className="transition-shadow duration-200 hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <span className="min-w-0 truncate text-base font-semibold leading-snug">
              {note.title}
            </span>

            <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  badge,
                )}
              >
                {icon}
                {label}
              </span>
              <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                복습 {note.review_round} / {MAX_REVIEW_ROUND}
              </span>
            </div>
          </div>

          <div className="my-3.5 border-t" />

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            마지막 수정 {formatDateTime(note.updated_at)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
