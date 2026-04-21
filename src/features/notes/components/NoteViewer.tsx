import hljs from "highlight.js";

import { normalizeTipTapMarkdown } from "@/features/editor/utils/serializeTipTapMarkdown";
import {
  isCodeLanguage,
  type NoteLanguage,
} from "@/lib/constants/noteLanguages";
import { cn } from "@/lib/utils/cn";

import { MarkdownNoteViewerClient } from "./MarkdownNoteViewerClient";

type NoteViewerProps = {
  content: string;
  language: NoteLanguage | null;
  className?: string;
};

export function NoteViewer({ content, language, className }: NoteViewerProps) {
  const effectiveLanguage = language ?? "markdown";

  if (!isCodeLanguage(effectiveLanguage)) {
    if (!content) {
      return (
        <div className={cn("py-6 text-muted-foreground/40", className)}>
          미리보기할 내용이 없습니다.
        </div>
      );
    }

    const normalizedContent = normalizeTipTapMarkdown(content);

    return (
      <MarkdownNoteViewerClient
        content={normalizedContent}
        className={cn(
          "[&_.tiptap]:px-0! [&_.tiptap]:py-6! sm:[&_.tiptap]:px-0!",
          className,
        )}
      />
    );
  }

  const highlighted = hljs.highlight(content, {
    language: effectiveLanguage,
    ignoreIllegals: true,
  });

  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg bg-zinc-900 px-0 py-6 font-mono text-base leading-relaxed text-zinc-100",
        className,
      )}
    >
      <code
        className={`hljs language-${effectiveLanguage}`}
        dangerouslySetInnerHTML={{ __html: highlighted.value }}
      />
    </pre>
  );
}
