import { type Editor, useEditor } from "@tiptap/react";
import { useEffect, useRef } from "react";

import { getTipTapExtensions } from "@/features/editor/utils/tiptapExtensions";

type UseTipTapEditorOptions = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  readOnly?: boolean;
  autoFocus?: boolean;
};

type MarkdownStorage = { markdown: { getMarkdown: () => string } };

function getMarkdown(editor: Editor): string {
  return (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();
}

export function useTipTapEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  autoFocus = false,
}: UseTipTapEditorOptions): Editor | null {
  const onChangeRef = useRef(onChange);
  const skipNextUpdate = useRef(true);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    extensions: getTipTapExtensions({ placeholder }),
    content: value,
    editable: !readOnly,
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    onCreate() {
      skipNextUpdate.current = false;
    },
    onUpdate({ editor }) {
      if (skipNextUpdate.current) return;
      onChangeRef.current(getMarkdown(editor));
    },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (getMarkdown(editor) === value) return;

    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  return editor;
}
