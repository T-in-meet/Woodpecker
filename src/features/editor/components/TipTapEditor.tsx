"use client";

import type { AnyExtension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils/cn";

import { useTipTapEditor } from "../hooks/useTipTapEditor";

type TipTapEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  disableReadOnlyCheckboxes?: boolean;
  autoFocus?: boolean;
  className?: string;
  "aria-label"?: string;
  onEditorReady?: (editor: Editor) => void;
  extensions?: AnyExtension[];
};

export function TipTapEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  disableReadOnlyCheckboxes = false,
  autoFocus = false,
  className,
  "aria-label": ariaLabel,
  onEditorReady,
  extensions,
}: TipTapEditorProps) {
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;
  const editorReadyFired = useRef(false);

  const editor = useTipTapEditor({
    value,
    onChange,
    placeholder,
    readOnly,
    autoFocus,
    extensions,
  });

  useEffect(() => {
    if (editor && !editorReadyFired.current) {
      editorReadyFired.current = true;
      onEditorReadyRef.current?.(editor);
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const el = editor.view.dom;

    if (ariaLabel) {
      el.setAttribute("aria-label", ariaLabel);
    } else {
      el.removeAttribute("aria-label");
    }
  }, [editor, ariaLabel]);

  useEffect(() => {
    if (!editor) return;

    const checkboxes = editor.view.dom.querySelectorAll(
      'input[type="checkbox"]',
    );

    for (const checkbox of checkboxes) {
      if (!(checkbox instanceof HTMLInputElement)) continue;

      checkbox.disabled = readOnly && disableReadOnlyCheckboxes;
    }
  }, [disableReadOnlyCheckboxes, editor, readOnly, value]);

  return (
    <div
      className={cn(
        "tiptap-wrapper overflow-hidden rounded-md border border-border bg-background text-base transition-colors",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
        readOnly && "[&_.tiptap]:cursor-default",
        className,
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
