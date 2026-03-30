"use client";

import { forwardRef, useImperativeHandle } from "react";

import { cn } from "@/lib/utils/cn";

import { useMarkdownEditor } from "../hooks/useMarkdownEditor";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
  "aria-label"?: string;
};

export type MarkdownEditorHandle = {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleStrikethrough: () => void;
  toggleCode: () => void;
};

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor(
  {
    value,
    onChange,
    placeholder,
    readOnly = false,
    autoFocus = false,
    className,
    "aria-label": ariaLabel,
  },
  ref,
) {
  const {
    containerRef,
    toggleBold,
    toggleItalic,
    toggleStrikethrough,
    toggleCode,
  } = useMarkdownEditor({
    doc: value,
    onChange,
    placeholder,
    readOnly,
    autoFocus,
    ariaLabel,
  });

  useImperativeHandle(ref, () => ({
    toggleBold,
    toggleItalic,
    toggleStrikethrough,
    toggleCode,
  }));

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden rounded-md border border-border bg-background text-sm transition-colors",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
        "[&_.cm-editor]:min-h-80 [&_.cm-editor]:bg-transparent",
        "[&_.cm-editor]:text-sm [&_.cm-editor]:text-foreground",
        "[&_.cm-editor.cm-focused]:outline-none",
        "[&_.cm-scroller]:min-h-80 [&_.cm-scroller]:overflow-auto",
        "[&_.cm-content]:py-4",
        "[&_.cm-gutters]:border-r [&_.cm-gutters]:border-border",
        "[&_.cm-gutters]:bg-muted/30",
        readOnly && "[&_.cm-content]:cursor-default",
        className,
      )}
    />
  );
});
