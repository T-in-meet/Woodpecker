import { FileText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getNoteDetailRoute } from "@/lib/constants/routes";

import type { NoteChatUsedNoteSource } from "../types";

type NoteChatReferenceNotesProps = {
  sources: NoteChatUsedNoteSource[];
  usedNoteIds: string[];
};

/**
 * AI 답변이 실제로 사용한 참고 노트를 표시합니다.
 */
export function NoteChatReferenceNotes({
  sources,
  usedNoteIds,
}: NoteChatReferenceNotesProps) {
  const sourceByNoteId = new Map(
    sources.map((source) => [source.noteId, source]),
  );

  const usedSources = usedNoteIds.flatMap((noteId) => {
    const source = sourceByNoteId.get(noteId);

    return source ? [source] : [];
  });

  if (usedSources.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {usedSources.map((source) => (
        <Button
          key={source.noteId}
          asChild
          size="sm"
          variant="outline"
          className="h-7 max-w-56 justify-start gap-1.5 px-2 text-xs"
        >
          <Link href={getNoteDetailRoute(source.noteId)}>
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{source.title}</span>
          </Link>
        </Button>
      ))}
    </div>
  );
}
