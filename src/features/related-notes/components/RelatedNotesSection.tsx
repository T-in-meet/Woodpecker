"use client";

import { FileText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getNoteDetailRoute } from "@/lib/constants/routes";

import { useRelatedNotes } from "../hooks/use-related-notes";

type RelatedNotesSectionProps = {
  /** Related Notes를 조회할 기준 Note ID입니다. */
  noteId: string;
};

/**
 * 노트 상세 하단에 현재 연결된 Related Notes를 표시합니다.
 *
 * Related Notes는 노트 본문과 독립적으로 조회하며,
 * active 상태의 관계만 화면에 표시합니다.
 *
 * @param props Related Notes를 조회할 기준 Note ID
 */
export function RelatedNotesSection({ noteId }: RelatedNotesSectionProps) {
  const { data: recommendations = [], isLoading } = useRelatedNotes(noteId);

  if (isLoading || recommendations.length === 0) {
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
