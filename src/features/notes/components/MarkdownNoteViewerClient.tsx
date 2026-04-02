"use client";

import { TipTapEditor } from "@/features/editor/components/TipTapEditor";
import { getReadOnlyTipTapExtensions } from "@/features/editor/utils/tiptapExtensions";
import { cn } from "@/lib/utils/cn";

type MarkdownNoteViewerClientProps = {
  content: string;
  className?: string;
};

const readOnlyExtensions = getReadOnlyTipTapExtensions();

export function MarkdownNoteViewerClient({
  content,
  className,
}: MarkdownNoteViewerClientProps) {
  return (
    <TipTapEditor
      value={content}
      readOnly
      extensions={readOnlyExtensions}
      className={cn(
        "border-none focus-within:border-none focus-within:ring-0",
        className,
      )}
    />
  );
}
