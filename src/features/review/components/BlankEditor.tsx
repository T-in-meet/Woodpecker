"use client";

import { CodeEditor } from "@/features/editor/components/CodeEditor";
import { TipTapEditor } from "@/features/editor/components/TipTapEditor";
import {
  isCodeLanguage,
  type NoteLanguage,
} from "@/lib/constants/noteLanguages";

type BlankEditorProps = {
  language: NoteLanguage | null;
  value: string;
  onChange: (value: string) => void;
};

export function BlankEditor({ language, value, onChange }: BlankEditorProps) {
  const effectiveLanguage = language ?? "markdown";

  if (isCodeLanguage(effectiveLanguage)) {
    return (
      <CodeEditor
        value={value}
        onChange={onChange}
        language={effectiveLanguage}
        aria-label="답안"
        className="min-h-[60vh] rounded-none border-none [&_.cm-editor]:min-h-[60vh] [&_.cm-scroller]:min-h-[60vh] [&_.cm-content]:px-6! [&_.cm-content]:py-5! [&_.cm-gutters]:border-none [&_.cm-gutters]:bg-transparent"
      />
    );
  }

  return (
    <TipTapEditor
      value={value}
      onChange={onChange}
      placeholder="기억나는 내용을 적어보세요..."
      autoFocus
      aria-label="답안"
      className="rounded-none border-none focus-within:border-none focus-within:ring-0 [&_.tiptap]:min-h-[60vh] [&_.tiptap]:px-6! [&_.tiptap]:py-5!"
    />
  );
}
