import { FileText, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RelatedNoteRecommendation } from "@/features/related-notes/types";
import { getNoteDetailRoute } from "@/lib/constants/routes";

type RelatedNoteItemProps = {
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
export function RelatedNoteItem({ relatedNote }: RelatedNoteItemProps) {
  const reason =
    typeof relatedNote.reason === "string" ? relatedNote.reason.trim() : "";

  const isManual = relatedNote.origin === "manual";

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={getNoteDetailRoute(relatedNote.noteId)}
          className="flex min-w-0 flex-1 items-center gap-2 font-medium text-foreground hover:underline"
        >
          <FileText className="size-4 shrink-0" />
          <span className="truncate">{relatedNote.title}</span>
        </Link>

        <Badge variant="secondary" className="shrink-0">
          {isManual ? "직접 연결" : "AI 추천"}
        </Badge>

        {reason && (
          <span
            className="min-w-0 max-w-[40%] truncate text-sm text-muted-foreground"
            title={reason}
          >
            {reason}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {isManual && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="관련 노트 수정"
            >
              <Pencil className="size-4" />
            </Button>
          )}

          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="관련 노트 삭제"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
