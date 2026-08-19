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
 * 개별 Related Note의 제목, 생성 출처, 이유와 관리 액션을 표시합니다.
 *
 * manual 관계는 사용자가 작성한 reason을 수정할 수 있고,
 * AI 추천은 추천 이유를 표시하되 직접 수정하지 않습니다.
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
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={getNoteDetailRoute(relatedNote.noteId)}
              className="flex min-w-0 items-center gap-2 font-medium text-foreground hover:underline"
            >
              <FileText className="size-4 shrink-0" />
              <span className="truncate">{relatedNote.title}</span>
            </Link>

            <Badge variant="secondary">
              {isManual ? "직접 연결" : "AI 추천"}
            </Badge>
          </div>

          {reason && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {reason}
            </p>
          )}
        </div>

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
