"use client";

import { useMemo } from "react";

import { TipTapEditor } from "@/features/editor/components/TipTapEditor";
import { getReadOnlyTipTapExtensions } from "@/features/editor/utils/tiptapExtensions";
import { cn } from "@/lib/utils/cn";

type MarkdownNoteViewerClientProps = {
  content: string;
  className?: string | undefined;
};

export function MarkdownNoteViewerClient({
  content,
  className,
}: MarkdownNoteViewerClientProps) {
  const extensions = useMemo(() => getReadOnlyTipTapExtensions(), []);

  return (
    <TipTapEditor
      value={content}
      readOnly
      extensions={extensions}
      className={cn(
        "border-none focus-within:border-none focus-within:ring-0",
        className,
      )}
    />
  );
}
