"use client";

import { useEffect, useMemo, useState } from "react";

import { TipTapEditor } from "@/features/editor/components/TipTapEditor";
import { getReadOnlyTipTapExtensions } from "@/features/editor/utils/tiptapExtensions";
import { cn } from "@/lib/utils/cn";

type MarkdownNoteViewerClientProps = {
  content: string;
  className?: string;
};

const noop = () => {};

export function MarkdownNoteViewerClient({
  content,
  className,
}: MarkdownNoteViewerClientProps) {
  const [hasMounted, setHasMounted] = useState(false);
  const readOnlyExtensions = useMemo(() => getReadOnlyTipTapExtensions(), []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <pre
        className={cn(
          "overflow-x-auto whitespace-pre-wrap break-words px-12 text-sm leading-relaxed text-foreground",
          className,
        )}
      >
        {content}
      </pre>
    );
  }

  return (
    <TipTapEditor
      value={content}
      onChange={noop}
      readOnly
      extensions={readOnlyExtensions}
      className={cn(
        "border-none focus-within:border-none focus-within:ring-0",
        className,
      )}
    />
  );
}
