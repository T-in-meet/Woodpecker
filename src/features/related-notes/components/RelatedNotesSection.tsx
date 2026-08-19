"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useRelatedNotes } from "../hooks/use-related-notes";
import { AddRelatedNoteDialog } from "./AddRelatedNoteDialog";
import { RelatedNoteItem } from "./RelatedNoteItem";

type RelatedNotesSectionProps = {
  /** Related Notes를 조회할 기준 Note ID입니다. */
  noteId: string;
};

/**
 * 노트 상세 하단에 현재 연결된 Related Notes를 표시합니다.
 *
 * Related Notes는 노트 본문과 독립적으로 조회하며,
 * active 상태의 manual/ai 관계를 표시합니다.
 *
 * 목록이 비어 있어도 사용자가 직접 Related Note를 추가할 수 있도록
 * 섹션 자체는 유지합니다.
 *
 * @param props Related Notes를 조회할 기준 Note ID
 */
export function RelatedNotesSection({ noteId }: RelatedNotesSectionProps) {
  const { data: relatedNotes = [], isLoading } = useRelatedNotes(noteId);

  if (isLoading) {
    return null;
  }

  return (
    <section className="border-t border-border/60 pt-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">관련 노트</h2>
        </div>

        <AddRelatedNoteDialog noteId={noteId} />
      </div>

      {relatedNotes.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            아직 연결된 관련 노트가 없습니다.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {relatedNotes.map((relatedNote) => (
            <RelatedNoteItem
              key={relatedNote.noteId}
              relatedNote={relatedNote}
            />
          ))}
        </div>
      )}
    </section>
  );
}
