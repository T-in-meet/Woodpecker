"use client";

import { cn } from "@/lib/utils/cn";

import { useCodeMirror } from "../hooks/useCodeMirror";
import type { SupportedLanguage } from "../supportedLanguages";

type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  language: SupportedLanguage;
  className?: string;
  readOnly?: boolean;
  "aria-label"?: string;
};

const noop = () => {};

export function CodeEditor({
  value,
  onChange,
  language,
  className,
  readOnly = false,
  "aria-label": ariaLabel,
}: CodeEditorProps) {
  const { containerRef } = useCodeMirror({
    doc: value,
    language,
    onChange: onChange ?? noop,
    ariaLabel,
    readOnly,
  });

  return (
    <div
      ref={containerRef}
      className={cn(
        "min-h-50 rounded-md border border-border font-mono text-base",
        className,
      )}
    />
  );
}
