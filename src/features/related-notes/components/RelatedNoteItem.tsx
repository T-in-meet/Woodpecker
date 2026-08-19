import { FileText, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RelatedNoteRecommendation } from "@/features/related-notes/types";
import { getNoteDetailRoute } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

import { DeleteRelatedNoteAlertDialog } from "./DeleteRelatedNoteAlertDialog";
import { RelatedNoteReasonTooltip } from "./RelatedNoteReasonTooltip";
import { UpdateRelatedNoteReasonDialog } from "./UpdateRelatedNoteReasonDialog";

type RelatedNoteItemProps = {
  /** Related Notes가 연결된 기준 Note ID입니다. */
  noteId: string;

  /** 화면에 표시할 Related Note 관계입니다. */
  relatedNote: RelatedNoteRecommendation;
};

/**
 * 개별 Related Note의 제목, 생성 출처, 이유와 관리 액션을 한 줄로 표시합니다.
 *
 * manual 관계는 사용자가 작성한 reason을 수정할 수 있고,
 * AI 추천은 추천 이유를 표시하되 직접 수정하지 않습니다.
 *
 * 제목과 reason은 공간이 부족한 경우 truncate하여
 * Related Note 항목의 높이가 늘어나지 않도록 합니다.
 *
 * 실제 수정/삭제 동작은 후속 구현에서 연결합니다.
 *
 * @param props 표시할 Related Note 관계
 */
export function RelatedNoteItem({ noteId, relatedNote }: RelatedNoteItemProps) {
  const reason =
    typeof relatedNote.reason === "string" ? relatedNote.reason.trim() : "";

  const isManual = relatedNote.origin === "manual";

  return (
    <div className="rounded-lg border bg-card px-3 py-1">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={getNoteDetailRoute(relatedNote.noteId)}
          className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-foreground hover:underline"
        >
          <FileText className="size-4 shrink-0" />
          <span className="truncate">{relatedNote.title}</span>
        </Link>

        <RelatedNoteReasonTooltip reason={reason} />

        <Badge
          variant="secondary"
          className={cn(
            "shrink-0",
            isManual
              ? "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
              : "bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-300",
          )}
        >
          {isManual ? "직접 연결" : "AI 추천"}
        </Badge>

        <div className="flex w-20 shrink-0 items-center justify-end gap-1">
          {isManual && (
            <UpdateRelatedNoteReasonDialog
              noteId={noteId}
              relatedNoteId={relatedNote.noteId}
              title={relatedNote.title}
              reason={reason}
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="관련 노트 수정"
              >
                <Pencil className="size-4" />
              </Button>
            </UpdateRelatedNoteReasonDialog>
          )}

          <DeleteRelatedNoteAlertDialog
            noteId={noteId}
            relatedNoteId={relatedNote.noteId}
            title={relatedNote.title}
            origin={relatedNote.origin}
          >
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="관련 노트 삭제"
            >
              <Trash2 className="size-4" />
            </Button>
          </DeleteRelatedNoteAlertDialog>
        </div>
      </div>
    </div>
  );
}
