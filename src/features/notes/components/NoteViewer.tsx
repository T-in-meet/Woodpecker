import { cn } from "@/lib/utils/cn";

import { MarkdownNoteViewerClient } from "./MarkdownNoteViewerClient";

type NoteViewerProps = {
  content: string;
  className?: string;
};

export function NoteViewer({ content, className }: NoteViewerProps) {
  if (!content) {
    return (
      <div className={cn("py-6 text-muted-foreground/40", className)}>
        미리보기할 내용이 없습니다.
      </div>
    );
  }

  return (
    <MarkdownNoteViewerClient
      content={content}
      className={cn(
        "[&_.tiptap]:px-0! [&_.tiptap]:py-6! sm:[&_.tiptap]:px-0!",
        className,
      )}
    />
  );
}
