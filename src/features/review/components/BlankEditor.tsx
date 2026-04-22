"use client";

import { TipTapEditor } from "@/features/editor/components/TipTapEditor";

type BlankEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function BlankEditor({ value, onChange }: BlankEditorProps) {
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
