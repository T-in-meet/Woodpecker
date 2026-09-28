"use client";

import type { AnyExtension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

import { useTipTapEditor } from "../hooks/useTipTapEditor";
import { BlockHandleMenu } from "./BlockHandleMenu";
import { InlineFormatToolbar } from "./InlineFormatToolbar";

type TipTapEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
  "aria-label"?: string;
  onEditorReady?: (editor: Editor) => void;
  onArrowUpAtStart?: () => void;
  extensions?: AnyExtension[];
};

export function TipTapEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  autoFocus = false,
  className,
  "aria-label": ariaLabel,
  onEditorReady,
  onArrowUpAtStart,
  extensions,
}: TipTapEditorProps) {
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;
  const editorReadyFired = useRef(false);
  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false);

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

  const onArrowUpAtStartRef = useRef(onArrowUpAtStart);
  onArrowUpAtStartRef.current = onArrowUpAtStart;

  useEffect(() => {
    if (!editor) return;
    if (!onArrowUpAtStart) return;

    const el = editor.view.dom;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowUp") return;
      if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey)
        return;

      const { selection, doc } = editor.state;
      if (!selection.empty) return;

      const $from = selection.$from;
      // 첫 textblock의 첫 위치인지 — 문서의 첫 번째 자식과 동일하고 그 안의 offset이 0.
      const isAtFirstBlockStart =
        $from.parentOffset === 0 && $from.before(1) === 0 && doc.firstChild
          ? $from.node(1) === doc.firstChild
          : false;

      if (!isAtFirstBlockStart) return;

      event.preventDefault();
      onArrowUpAtStartRef.current?.();
    };

    el.addEventListener("keydown", handleKeyDown);
    return () => {
      el.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, onArrowUpAtStart]);

  // 에디터는 클라이언트에서 생성되므로 서버 HTML의 본문 영역이 비어 LCP가 에디터 생성을 기다린다.
  // Placeholder 확장이 만드는 빈 문단과 같은 마크업을 먼저 그려 같은 CSS로 같은 크기를 유지한다.
  const showStaticPlaceholder =
    !editor && !readOnly && !extensions && Boolean(placeholder) && value === "";

  return (
    <div
      className={cn(
        "tiptap-wrapper relative overflow-hidden rounded-md border border-border bg-background text-base transition-colors",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
        readOnly && "[&_.tiptap]:cursor-default",
        className,
      )}
    >
      {editor && !readOnly && (
        <>
          <BlockHandleMenu
            editor={editor}
            onMenuOpenChange={setIsBlockMenuOpen}
          />
          <InlineFormatToolbar
            editor={editor}
            isBlockMenuOpen={isBlockMenuOpen}
          />
        </>
      )}
      {showStaticPlaceholder && (
        <div className="tiptap" aria-hidden="true" data-static-placeholder="">
          <p className="is-editor-empty" data-placeholder={placeholder}>
            <br className="ProseMirror-trailingBreak" />
          </p>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
