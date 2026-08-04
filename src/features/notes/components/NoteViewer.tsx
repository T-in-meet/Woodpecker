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
        // 배경 블록은 좌우로 0.375rem 삐져나오게 만들어져 있다(tiptap.css).
        // 좌우 패딩이 0이면 그만큼이 wrapper의 overflow-hidden에 잘려 모서리가 각지므로,
        // 같은 크기의 패딩을 주고 wrapper를 그만큼 당겨 글자 위치는 그대로 둔다.
        "-mx-1.5 [&_.tiptap]:px-1.5! [&_.tiptap]:py-6! sm:[&_.tiptap]:px-1.5!",
        className,
      )}
    />
  );
}
