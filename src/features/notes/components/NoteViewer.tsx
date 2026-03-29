import hljs from "highlight.js";

import { MarkdownPreview } from "@/features/notes/components/MarkdownPreview";
import {
  isCodeLanguage,
  type NoteLanguage,
} from "@/lib/constants/noteLanguages";
import { cn } from "@/lib/utils/cn";

type NoteViewerProps = {
  content: string;
  language: NoteLanguage | null;
  className?: string;
};

export function NoteViewer({ content, language, className }: NoteViewerProps) {
  const effectiveLanguage = language ?? "markdown";

  if (!isCodeLanguage(effectiveLanguage)) {
    return <MarkdownPreview content={content} className={className} />;
  }

  const highlighted = hljs.highlight(content, {
    language: effectiveLanguage,
    ignoreIllegals: true,
  });

  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg bg-zinc-900 px-6 py-5 font-mono text-sm leading-relaxed text-zinc-100",
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
