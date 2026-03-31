import hljs from "highlight.js";

import { TipTapEditor } from "@/features/editor/components/TipTapEditor";
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

const noop = () => {};

export function NoteViewer({ content, language, className }: NoteViewerProps) {
  const effectiveLanguage = language ?? "markdown";

  if (!isCodeLanguage(effectiveLanguage)) {
    if (!content) {
      return (
        <div className={cn("px-12 py-6 text-muted-foreground/40", className)}>
          미리보기할 내용이 없습니다.
        </div>
      );
    }

    return (
      <TipTapEditor
        value={content}
        onChange={noop}
        readOnly
        className={cn(
          "border-none focus-within:ring-0 focus-within:border-none",
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
