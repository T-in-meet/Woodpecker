"use client";

import { TipTapEditor } from "@/features/editor/components/TipTapEditor";
import { useDesktopInitialFocus } from "@/hooks/useDesktopInitialFocus";

type BlankEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function BlankEditor({ value, onChange }: BlankEditorProps) {
  const focusOnce = useDesktopInitialFocus();
  return (
    <TipTapEditor
      value={value}
      onChange={onChange}
      placeholder="기억나는 내용을 적어보세요..."
      onEditorReady={(editor) => focusOnce(() => editor.commands.focus("end"))}
      aria-label="답안"
      className="rounded-none border-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset [&_.tiptap]:min-h-[60vh] [&_.tiptap]:px-6! [&_.tiptap]:py-5!"
    />
  );
}
