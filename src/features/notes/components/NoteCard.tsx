import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { getNoteDetailRoute } from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/utils/formatDate";

import type { NoteSummary } from "../queries";

type NoteCardProps = {
  note: NoteSummary;
};

function getReviewStatusText(note: NoteSummary): string {
  if (note.review_round >= MAX_REVIEW_ROUND && note.next_review_at === null) {
    return "1-3-7 복습 완료";
  }

  if (!note.next_review_at) {
    return "다음 복습 일정 준비 중";
  }

  if (new Date(note.next_review_at).getTime() <= Date.now()) {
    return "지금 백지 테스트 가능";
  }

  return `다음 복습 ${formatDateTime(note.next_review_at)}`;
}

export function NoteCard({ note }: NoteCardProps) {
  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-1 font-medium text-foreground">
            {note.language ?? "markdown"}
          </span>
          <span className="rounded-full bg-muted px-2 py-1 font-medium text-foreground">
            복습 {note.review_round} / {MAX_REVIEW_ROUND}
          </span>
        </div>
        <CardTitle className="text-xl leading-snug">
          <Link
            href={getNoteDetailRoute(note.id)}
            className="transition-colors hover:text-primary"
          >
            {note.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-foreground">{getReviewStatusText(note)}</p>
        <p className="text-xs text-muted-foreground">
          마지막 수정 {formatDateTime(note.updated_at)}
        </p>
      </CardContent>
    </Card>
  );
}
