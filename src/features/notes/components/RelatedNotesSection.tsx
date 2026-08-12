import { FileText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { RelatedNoteRecommendation } from "@/features/related-notes/types";
import { getNoteDetailRoute } from "@/lib/constants/routes";

type RelatedNotesSectionProps = {
  /** 노트 하단에 표시할 관련 노트 추천 목록입니다. */
  recommendations: RelatedNoteRecommendation[];
};

/**
 * 노트 상세 하단에 관련 노트 추천 링크 목록을 표시합니다.
 *
 * @param props 관련 노트 추천 목록
 */
export function RelatedNotesSection({
  recommendations,
}: RelatedNotesSectionProps) {
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-border/60 pt-6">
      <h2 className="text-sm font-semibold text-foreground">관련 노트</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {recommendations.map((recommendation) => (
          <Button
            key={recommendation.noteId}
            asChild
            type="button"
            size="sm"
            variant="outline"
          >
            <Link href={getNoteDetailRoute(recommendation.noteId)}>
              <FileText className="size-4" />
              {recommendation.title}
            </Link>
          </Button>
        ))}
      </div>
    </section>
  );
}
