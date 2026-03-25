"use client";

import { cn } from "@/lib/utils/cn";

import type { SupportedLanguage } from "../config";
import { useCodeMirror } from "../hooks/useCodeMirror";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: SupportedLanguage;
  className?: string;
}

export function CodeEditor({
  value,
  onChange,
  language,
  className,
}: CodeEditorProps) {
  const { containerRef } = useCodeMirror({ doc: value, language, onChange });

  return (
    <div
      ref={containerRef}
      className={cn(
        "min-h-50 rounded-md border border-border font-mono text-sm",
        className,
      )}
    />
  );
}
